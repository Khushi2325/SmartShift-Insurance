/**
 * Automated Trigger Checker for Insurance Claims
 * Monitors active policies and auto-creates claims when weather/risk conditions are met
 */

const logger = {
  info: (...args) => console.log('[TRIGGER]', ...args),
  warn: (...args) => console.warn('[TRIGGER]', ...args),
  error: (...args) => console.error('[TRIGGER]', ...args),
};

/**
 * Parse plan triggers and evaluate against current conditions
 * Trigger formats: "Rainfall > 20 mm/hr", "AQI > 300", "Heatwave > 40°C or Flood risk"
 */
const evaluateTrigger = (triggerText, conditions) => {
  if (!triggerText || !conditions) return false;

  const trigger = triggerText.toLowerCase().trim();

  // Rainfall trigger
  if (trigger.includes('rainfall')) {
    const match = trigger.match(/rainfall\s*>\s*(\d+)\s*mm/i);
    if (match) {
      const threshold = parseInt(match[1], 10);
      return conditions.rain_mm >= threshold;
    }
  }

  // AQI trigger
  if (trigger.includes('aqi')) {
    const match = trigger.match(/aqi\s*>\s*(\d+)/i);
    if (match) {
      const threshold = parseInt(match[1], 10);
      return conditions.aqi >= threshold;
    }
  }

  // Heatwave/Temperature trigger
  if (trigger.includes('heatwave') || trigger.includes('temperature') || trigger.includes('heat') || trigger.includes('>')) {
    const match = trigger.match(/(\d+)\s*°c|(\d+)\s*degree/i);
    if (match) {
      const threshold = parseInt(match[1] || match[2], 10);
      return conditions.temperature >= threshold;
    }
  }

  // Flood risk (qualitative)
  if (trigger.includes('flood')) {
    return conditions.flood_risk === true;
  }

  return false;
};

/**
 * Get the latest conditions for a worker (from last logged location/weather)
 */
const getLatestWorkerConditions = async (dbPool, workerId) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        city,
        rain_mm,
        rain_probability,
        aqi,
        temperature,
        traffic_delay_ratio,
        ai_score,
        created_at
      FROM worker_location_risk_logs
      WHERE worker_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [workerId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      city: row.city,
      rain_mm: Number(row.rain_mm || 0),
      rain_probability: Number(row.rain_probability || 0),
      aqi: Number(row.aqi || 0),
      temperature: Number(row.temperature || 0),
      ai_score: Number(row.ai_score || 0),
      traffic_delay_ratio: Number(row.traffic_delay_ratio || 1),
      flood_risk: Number(row.rain_mm || 0) > 30, // Synthetic: heavy rain = flood risk
      recorded_at: new Date(row.created_at),
    };
  } catch (error) {
    logger.error(`Failed to fetch conditions for worker ${workerId}:`, error.message);
    return null;
  }
};

/**
 * Check if a claim was already created for this policy in the last 24 hours
 * (to avoid duplicate triggers)
 */
const hasRecentClaimForPolicy = async (dbPool, policyId) => {
  try {
    const result = await dbPool.query(`
      SELECT COUNT(*) as count
      FROM claims
      WHERE policy_id = $1
      AND created_at > NOW() - INTERVAL '24 hours'
    `, [policyId]);

    return Number(result.rows[0]?.count || 0) > 0;
  } catch (error) {
    logger.error(`Failed to check recent claims for policy ${policyId}:`, error.message);
    return false;
  }
};

/**
 * Create an auto-triggered claim for a worker
 */
const createAutoTriggerClaim = async (dbPool, workerId, policyId, triggerText, conditions, payoutAmount) => {
  try {
    const result = await dbPool.query(`
      INSERT INTO claims (
        worker_id,
        policy_id,
        trigger_type,
        payout_amount,
        status,
        auto_generated,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `, [
      workerId,
      policyId,
      'weather_trigger',
      payoutAmount,
      'Credited',
      true,
      `Auto-triggered by: ${triggerText} (AQI: ${conditions.aqi}, Rain: ${conditions.rain_mm}mm, Temp: ${conditions.temperature}°C)`
    ]);

    if (result.rows.length > 0) {
      const claim = result.rows[0];
      logger.info(`✓ Created auto-trigger claim #${claim.id} for worker ${workerId} (payout: ₹${payoutAmount})`);

      // Update wallet if it exists
      try {
        await dbPool.query(`
          UPDATE wallets
          SET balance = balance + $1,
              updated_at = NOW()
          WHERE worker_id = $2
        `, [payoutAmount, workerId]);
        logger.info(`✓ Updated wallet for worker ${workerId}: +₹${payoutAmount}`);
      } catch (walletError) {
        logger.warn(`Could not update wallet for worker ${workerId}:`, walletError.message);
      }

      return claim;
    }
  } catch (error) {
    logger.error(`Failed to create claim for worker ${workerId}:`, error.message);
  }
  return null;
};

/**
 * Main trigger check loop: runs every 5 minutes
 */
export const startTriggerChecker = (dbPool, intervalMs = 5 * 60 * 1000) => {
  if (!dbPool) {
    logger.warn('No DB pool provided; trigger checker not started');
    return;
  }

  logger.info('Starting automated trigger checker...');

  const checkTriggers = async () => {
    try {
      // Get all active policies
      const policiesResult = await dbPool.query(`
        SELECT 
          p.id as policy_id,
          p.worker_id,
          p.coverage_amount,
          p.status,
          w.active_plan
        FROM insurance_policies p
        JOIN workers w ON p.worker_id = w.id
        WHERE p.status = 'active'
        AND p.created_at > NOW() - INTERVAL '7 days'
      `);

      const policies = policiesResult.rows || [];
      logger.info(`Checking ${policies.length} active policies for triggers...`);

      for (const policy of policies) {
        try {
          const { policy_id, worker_id, coverage_amount, status, active_plan } = policy;

          // Get latest conditions for this worker
          const conditions = await getLatestWorkerConditions(dbPool, worker_id);
          if (!conditions) {
            // No recent location data; skip
            continue;
          }

          // Determine plan triggers based on active_plan or coverage_amount
          let triggers = [];
          const planId = (active_plan || '').toLowerCase() || '';

          if (activePlan.includes('day-shield') || coverage_amount === 800) {
            triggers = ['Rainfall > 20 mm/hr'];
          } else if (activePlan.includes('rush-hour-cover') || coverage_amount === 1200) {
            triggers = ['AQI > 300'];
          } else if (activePlan.includes('night-safety') || coverage_amount === 1600) {
            triggers = ['Heatwave > 40°C or Flood risk'];
          }

          // Evaluate triggers
          for (const trigger of triggers) {
            if (evaluateTrigger(trigger, conditions)) {
              // Check if claim already exists in last 24h
              const hasRecent = await hasRecentClaimForPolicy(dbPool, policy_id);
              if (!hasRecent) {
                await createAutoTriggerClaim(dbPool, worker_id, policy_id, trigger, conditions, coverage_amount);
              }
            }
          }
        } catch (policyError) {
          logger.error(`Error checking policy ${policy.policy_id}:`, policyError.message);
        }
      }

      logger.info('Trigger check cycle complete');
    } catch (error) {
      logger.error('Trigger checker error:', error instanceof Error ? error.message : String(error));
    }
  };

  // Run once immediately, then every intervalMs
  checkTriggers().catch((error) => {
    logger.error('Initial trigger check failed:', error.message);
  });

  const intervalId = setInterval(checkTriggers, intervalMs);

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('Trigger checker stopped');
    },
  };
};
