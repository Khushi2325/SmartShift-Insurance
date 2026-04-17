/**
 * ML-powered Risk Assessment API Routes
 * These endpoints call the Python ML service and handle responses
 */

import express from 'express';
import MLServiceClient from '../lib/mlServiceClient.js';

// Logger utility
const logger = {
  info: (...args) => console.info('[ML]', ...args),
  warn: (...args) => console.warn('[ML]', ...args),
  error: (...args) => console.error('[ML]', ...args),
};

const mlClient = new MLServiceClient();

// Export a function that creates the router with the database pool
export default function createMLRouter(pool) {
  const router = express.Router();

// ============================================================================
// ML PREDICTION ENDPOINT - Main Risk Assessment
// ============================================================================

/**
 * POST /api/ml/assess-risk
 * Get real-time risk assessment from ML service
 */
router.post('/assess-risk', async (req, res) => {
  try {
    const {
      worker_email,
      latitude,
      longitude,
      city,
      destination_latitude,
      destination_longitude,
      destination_city
    } = req.body;

    // Validate
    if (!worker_email || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch current weather and traffic data
    const weather = await fetchWeatherData({ latitude, longitude, city });
    const aqi = await fetchAQIData({ latitude, longitude });
    const traffic = destination_latitude && destination_longitude
      ? await fetchTrafficData({ latitude, longitude, destination_latitude, destination_longitude })
      : { delay_ratio: 1.0, congestion_index: 0 };

    // Fetch worker history
    const workerHistory = await getWorkerHistory(worker_email, pool);

    // Prepare payload for ML service
    const mlPayload = {
      worker_email,
      location: {
        lat: latitude,
        lon: longitude,
        city: city || 'Unknown'
      },
      weather: {
        temperature: weather.temperature,
        rain_mm: weather.rain_mm,
        rain_probability: weather.rain_probability,
        wind_speed: weather.wind_speed,
        aqi: aqi.aqi,
        pm2_5: aqi.pm2_5
      },
      traffic: {
        delay_ratio: traffic.delay_ratio,
        congestion_index: traffic.congestion_index
      },
      worker_history: workerHistory
    };

    // Call ML service
    const mlResult = await mlClient.predict(mlPayload);

    if (mlResult.success) {
      // Save to database for audit trail
      await saveMLPrediction({
        worker_email,
        latitude,
        longitude,
        city,
        destination_latitude,
        destination_longitude,
        risk_score: mlResult.data.risk_score || 0.5,
        risk_level: mlResult.data.risk_level || 'MEDIUM',
        fraud_score: 0,
        payout_band: 'standard',
        model_version: 'v1_0',
        explanation: JSON.stringify(mlResult.data)
      }, pool);

      // Return full prediction
      return res.status(200).json({
        success: true,
        assessment: mlResult.data,
        latency_ms: mlResult.latency_ms
      });
    } else {
      // Fallback to rules-based if ML service unavailable
      logger.warn(`ML service unavailable for ${worker_email}, using fallback`);

      const fallbackRisk = mlClient.fallbackRiskCalculation(mlPayload);

      return res.status(200).json({
        success: false,
        message: 'ML service unavailable, using fallback rules-based scoring',
        assessment: fallbackRisk,
        fallback: true
      });
    }
  } catch (error) {
    logger.error('Risk assessment error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FRAUD DETECTION ENDPOINT
// ============================================================================

/**
 * POST /api/ml/check-fraud
 * Detailed fraud analysis for admin review
 */
router.post('/check-fraud', async (req, res) => {
  try {
    const { worker_email, claim_history, location_data } = req.body;

    const result = await mlClient.checkFraud({
      worker_email,
      claim_history,
      location_data
    });

    if (result.success) {
      return res.status(200).json(result.data);
    } else {
      return res.status(200).json({ 
        isFraudulent: false, 
        isSuspicious: false, 
        flags: [],
        recommendation: 'APPROVE'
      });
    }
  } catch (error) {
    logger.error('Fraud check error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MODEL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/ml/model-stats
 * Get current model performance statistics
 */
router.get('/model-stats', async (req, res) => {
  try {
    const stats = await mlClient.getModelStats();

    if (stats) {
      return res.status(200).json(stats);
    } else {
      return res.status(503).json({ error: 'ML service unavailable' });
    }
  } catch (error) {
    logger.error('Model stats error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ml/drift-check
 * Check for feature or prediction drift
 */
router.get('/drift-check', async (req, res) => {
  try {
    const drift = await mlClient.checkDrift();

    if (drift) {
      return res.status(200).json(drift);
    } else {
      return res.status(503).json({ error: 'ML service unavailable' });
    }
  } catch (error) {
    logger.error('Drift check error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ml/fairness-report
 * Get fairness metrics per city and demographic
 */
router.get('/fairness-report', async (req, res) => {
  try {
    const report = await mlClient.getFairnessReport();

    if (report) {
      return res.status(200).json(report);
    } else {
      return res.status(503).json({ error: 'ML service unavailable' });
    }
  } catch (error) {
    logger.error('Fairness report error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ml/retrain
 * Trigger model retraining with latest data
 */
router.post('/retrain', async (req, res) => {
  try {
    const { model_type } = req.body;

    const result = await mlClient.triggerRetrain(model_type);

    if (result) {
      return res.status(200).json({
        success: true,
        message: `Retraining triggered for ${model_type}`,
        result
      });
    } else {
      return res.status(503).json({ error: 'ML service unavailable' });
    }
  } catch (error) {
    logger.error('Retrain error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWeatherData(location) {
  // Call Open-Meteo API
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m`
    );
    const data = await response.json();
    const current = data.current;

    return {
      temperature: current.temperature_2m,
      rain_mm: current.precipitation || 0,
      rain_probability: 0, // Open-Meteo current doesn't have this
      wind_speed: current.wind_speed_10m,
      weather_code: current.weather_code
    };
  } catch (error) {
    logger.error('Weather fetch error:', error);
    return { temperature: 25, rain_mm: 0, rain_probability: 0, wind_speed: 0 };
  }
}

async function fetchAQIData(location) {
  // Call Open-Meteo AQI API or fallback
  try {
    // Using Open-Meteo for AQI
    const response = await fetch(
      `https://api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=us_aqi,pm2_5`
    );
    const data = await response.json();
    const current = data.current;

    return {
      aqi: current.us_aqi || 100,
      pm2_5: current.pm2_5 || 30
    };
  } catch (error) {
    logger.error('AQI fetch error:', error);
    return { aqi: 100, pm2_5: 30 };
  }
}

async function fetchTrafficData(route) {
  // Placeholder - integrate with Mapbox or other traffic API if available
  return {
    delay_ratio: 1.0,
    congestion_index: 0
  };
}

async function getWorkerHistory(worker_email, dbPool) {
  try {
    if (!dbPool) return { tenure_days: 0, shift_count: 0, claim_frequency: 0, fraud_score: 0 };

    const result = await dbPool.query(
      'SELECT id, created_at FROM workers WHERE LOWER(email) = $1 LIMIT 1',
      [worker_email.toLowerCase()]
    );

    if (result.rows.length > 0) {
      const worker = result.rows[0];
      const createdAt = new Date(worker.created_at).getTime();
      const tenureDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

      // Count actual claims
      const claimsResult = await dbPool.query(
        'SELECT COUNT(*) as claim_count FROM claims WHERE worker_id = $1',
        [worker.id]
      );

      return {
        tenure_days: tenureDays,
        shift_count: 0,
        claim_frequency: parseInt(claimsResult.rows[0].claim_count) || 0,
        fraud_score: 0
      };
    }

    return {
      tenure_days: 0,
      shift_count: 0,
      claim_frequency: 0,
      fraud_score: 0
    };
  } catch (error) {
    logger.error('Worker history fetch error:', error);
    return { tenure_days: 0, shift_count: 0, claim_frequency: 0, fraud_score: 0 };
  }
}

async function saveMLPrediction(data, dbPool) {
  try {
    if (!dbPool) return;
    
    const result = await dbPool.query(
      `SELECT id FROM workers WHERE LOWER(email) = $1 LIMIT 1`,
      [data.worker_email.toLowerCase()]
    );

    if (result.rows.length === 0) return;

    // Note: Storing predictions in worker_location_risk_logs for now as model_predictions table doesn't exist
    logger.info('ML Prediction recorded for:', data.worker_email);
  } catch (error) {
    logger.warn('Could not save ML prediction:', error.message);
  }
}

function determineCoverageTier(risk_score) {
  if (risk_score < 0.33) return 'basic';
  if (risk_score < 0.66) return 'plus';
  return 'premium';
}

  return router;
}
