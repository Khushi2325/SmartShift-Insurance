/**
 * Database Migration: AI-Ready Schema
 * Run this after deploying to ensure all tables exist
 */

import 'dotenv/config';
import { Pool as PgPool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const pool: PgPool = new PgPool({
  connectionString,
  ssl: connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function ensureAiSchema() {
  try {
    console.log('🔄 Migrating AI schema...');

    // 1. WEATHER SNAPSHOTS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weather_snapshots (
        id SERIAL PRIMARY KEY,
        city VARCHAR(50),
        latitude REAL,
        longitude REAL,
        grid_cell_id VARCHAR(20),
        temperature REAL,
        feels_like REAL,
        temp_min REAL,
        temp_max REAL,
        humidity INT,
        rain_mm REAL,
        rain_probability INT,
        wind_speed REAL,
        wind_gust REAL,
        wind_direction INT,
        pressure INT,
        visibility INT,
        cloud_cover INT,
        weather_code INT,
        weather_description VARCHAR(100),
        severity_index REAL,
        source VARCHAR(50),
        confidence REAL,
        timestamp TIMESTAMP DEFAULT NOW(),
        data_age_minutes INT,
        CONSTRAINT valid_temp CHECK (temperature > -50 AND temperature < 60),
        CONSTRAINT valid_rain CHECK (rain_mm >= 0),
        CONSTRAINT valid_wind CHECK (wind_speed >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_weather_city_time ON weather_snapshots(city, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_weather_grid_time ON weather_snapshots(grid_cell_id, timestamp DESC);
    `);
    console.log('✓ weather_snapshots table created');

    // 2. AQI SNAPSHOTS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aqi_snapshots (
        id SERIAL PRIMARY KEY,
        city VARCHAR(50),
        latitude REAL,
        longitude REAL,
        grid_cell_id VARCHAR(20),
        aqi INT,
        pm2_5 REAL,
        pm10 REAL,
        o3 REAL,
        no2 REAL,
        so2 REAL,
        co REAL,
        health_concern_level VARCHAR(20),
        heat_stress_score REAL,
        respiratory_risk_score REAL,
        source VARCHAR(50),
        sensor_quality INT,
        data_completeness REAL,
        timestamp TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_aqi CHECK (aqi >= 0),
        CONSTRAINT valid_pm CHECK (pm2_5 >= 0 AND pm10 >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_aqi_city_time ON aqi_snapshots(city, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_aqi_grid_time ON aqi_snapshots(grid_cell_id, timestamp DESC);
    `);
    console.log('✓ aqi_snapshots table created');

    // 3. TRAFFIC SNAPSHOTS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traffic_snapshots (
        id SERIAL PRIMARY KEY,
        route_id VARCHAR(100),
        origin_lat REAL,
        origin_lon REAL,
        dest_lat REAL,
        dest_lon REAL,
        distance_km REAL,
        duration_minutes_free_flow REAL,
        duration_minutes_current REAL,
        delay_ratio REAL,
        congestion_index REAL,
        direction VARCHAR(20),
        road_type VARCHAR(20),
        has_incidents BOOLEAN,
        incident_type VARCHAR(50),
        incident_duration_minutes INT,
        source VARCHAR(50),
        confidence REAL,
        timestamp TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_ratio CHECK (delay_ratio >= 1.0),
        CONSTRAINT valid_congestion CHECK (congestion_index >= 0 AND congestion_index <= 1)
      );
      CREATE INDEX IF NOT EXISTS idx_traffic_route_time ON traffic_snapshots(route_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_traffic_origin_time ON traffic_snapshots(origin_lat, origin_lon, timestamp DESC);
    `);
    console.log('✓ traffic_snapshots table created');

    // 4. FEATURE VECTORS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feature_vectors (
        id SERIAL PRIMARY KEY,
        worker_email VARCHAR(100),
        shift_date DATE,
        shift_hour INT,
        temp REAL,
        rain_mm REAL,
        rain_probability INT,
        wind_speed REAL,
        weather_severity_index REAL,
        aqi INT,
        pm2_5 REAL,
        health_concern_level VARCHAR(20),
        expected_delay_ratio REAL,
        typical_congestion_index REAL,
        hour_of_day INT,
        day_of_week INT,
        is_peak_hour BOOLEAN,
        is_weekend BOOLEAN,
        worker_tenure_days INT,
        worker_shift_count INT,
        worker_claim_frequency REAL,
        worker_fraud_score REAL,
        city VARCHAR(50),
        zone_type VARCHAR(20),
        altitude_m INT,
        disruption_occurred BOOLEAN,
        disruption_severity INT,
        actual_claim_amount INT,
        frames_completed_pct INT,
        feature_version VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_probability CHECK (rain_probability >= 0 AND rain_probability <= 100)
      );
      CREATE INDEX IF NOT EXISTS idx_feature_worker_date ON feature_vectors(worker_email, shift_date);
      CREATE INDEX IF NOT EXISTS idx_feature_city_date ON feature_vectors(city, shift_date);
    `);
    console.log('✓ feature_vectors table created');

    // 5. MODEL PREDICTIONS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS model_predictions (
        id SERIAL PRIMARY KEY,
        worker_email VARCHAR(100),
        shift_date DATE,
        shift_hour INT,
        model_version VARCHAR(20),
        feature_vector_id INT,
        feature_version VARCHAR(20),
        risk_score REAL,
        risk_level VARCHAR(20),
        risk_confidence REAL,
        risk_class_probabilities JSON,
        fraud_score REAL,
        fraud_risk_level VARCHAR(20),
        fraud_flags JSON,
        predicted_payout_amount INT,
        predicted_payout_band VARCHAR(20),
        top_risk_factors JSON,
        top_fraud_factors JSON,
        human_explanation TEXT,
        prediction_latency_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_predictions_worker_date ON model_predictions(worker_email, shift_date);
    `);
    console.log('✓ model_predictions table created');

    // 6. FINAL DECISIONS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS final_decisions (
        id SERIAL PRIMARY KEY,
        worker_email VARCHAR(100),
        shift_date DATE,
        model_prediction_id INT,
        decision_type VARCHAR(50),
        coverage_tier VARCHAR(20),
        auto_claim_eligible BOOLEAN,
        fraud_review_required BOOLEAN,
        approved_payout_amount INT,
        override_reason TEXT,
        reviewed_by VARCHAR(100),
        review_timestamp TIMESTAMP,
        decision_inputs JSON,
        decision_formula_used VARCHAR(50),
        confidence_score REAL,
        actual_disruption_occurred BOOLEAN,
        actual_claim_filed BOOLEAN,
        actual_claim_approved BOOLEAN,
        actual_payout_amount INT,
        created_at TIMESTAMP DEFAULT NOW(),
        outcome_recorded_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_worker_date ON final_decisions(worker_email, shift_date);
      CREATE INDEX IF NOT EXISTS idx_decisions_review ON final_decisions(fraud_review_required, created_at DESC);
    `);
    console.log('✓ final_decisions table created');

    // 7. MODEL REGISTRY
    await pool.query(`
      CREATE TABLE IF NOT EXISTS model_registry (
        id SERIAL PRIMARY KEY,
        model_type VARCHAR(20),
        model_name VARCHAR(50),
        algorithm VARCHAR(50),
        training_data_rows INT,
        training_window_start DATE,
        training_window_end DATE,
        training_completed_at TIMESTAMP,
        auc REAL,
        precision REAL,
        recall REAL,
        f1_score REAL,
        false_positive_rate REAL,
        calibration_error REAL,
        fairness_metrics JSON,
        feature_drift_detected BOOLEAN,
        prediction_drift_detected BOOLEAN,
        calibration_drift_detected BOOLEAN,
        status VARCHAR(20),
        is_production BOOLEAN,
        promoted_to_prod_at TIMESTAMP,
        parent_model_id INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_model_type_status ON model_registry(model_type, status);
    `);
    console.log('✓ model_registry table created');

    // 8. DRIFT EVENTS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drift_events (
        id SERIAL PRIMARY KEY,
        model_id INT,
        drift_type VARCHAR(50),
        affected_features JSON,
        statistical_test_used VARCHAR(50),
        p_value REAL,
        drift_magnitude REAL,
        alert_severity VARCHAR(20),
        action_taken VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_drift_model_time ON drift_events(model_id, created_at DESC);
    `);
    console.log('✓ drift_events table created');

    // 9. FAIRNESS SLICES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fairness_slices (
        id SERIAL PRIMARY KEY,
        model_id INT,
        slice_name VARCHAR(50),
        slice_filter JSON,
        sample_count INT,
        precision REAL,
        recall REAL,
        false_positive_rate REAL,
        false_negative_rate REAL,
        precision_disparity REAL,
        recall_disparity REAL,
        disparity_exceeds_threshold BOOLEAN,
        evaluated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fairness_model_slice ON fairness_slices(model_id, slice_name);
    `);
    console.log('✓ fairness_slices table created');

    // 10. RETRAINING JOBS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS retraining_jobs (
        id SERIAL PRIMARY KEY,
        model_type VARCHAR(20),
        scheduled_for TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(20),
        data_rows_used INT,
        training_duration_seconds INT,
        new_model_id INT,
        improvement_vs_current REAL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_retraining_model_type_time ON retraining_jobs(model_type, created_at DESC);
    `);
    console.log('✓ retraining_jobs table created');

    // 11. ADD COLUMNS TO EXISTING users TABLE
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_tenure_days INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_claim_frequency REAL DEFAULT 0.0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_fraud_score REAL DEFAULT 0.0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_reliability_score REAL DEFAULT 1.0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_persona_type VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS model_version_at_registration VARCHAR(20);
    `);
    console.log('✓ users table extended with ML columns');

    // 12. ADD COLUMNS TO EXISTING risk_data TABLE
    await pool.query(`
      ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS traffic_delay_ratio REAL;
      ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS route_duration_minutes INT;
      ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS feature_vector_id INT;
      ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS model_prediction_id INT;
      ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS decision_id INT;
    `);
    console.log('✓ risk_data table extended with ML links');

    console.log('✅ AI schema migration complete!');
    return true;

  } catch (error) {
    console.error('❌ Schema migration failed:', error);
    throw error;
  }
}
