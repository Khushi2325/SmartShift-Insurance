# AI-Ready Database Schema 🗄️

## Tables to Create/Modify

### 1. EXTERNAL DATA SNAPSHOTS

#### weather_snapshots
```sql
CREATE TABLE weather_snapshots (
  id SERIAL PRIMARY KEY,
  city VARCHAR(50),
  latitude REAL,
  longitude REAL,
  grid_cell_id VARCHAR(20), -- For efficient spatial queries
  
  -- Temperature & humidity
  temperature REAL,
  feels_like REAL,
  temp_min REAL,
  temp_max REAL,
  humidity INT,
  
  -- Precipitation
  rain_mm REAL,
  rain_probability INT,
  
  -- Wind & pressure
  wind_speed REAL,
  wind_gust REAL,
  wind_direction INT,
  pressure INT,
  
  -- Visibility & clouds
  visibility INT,
  cloud_cover INT,
  
  -- Weather code
  weather_code INT, -- WMO code
  weather_description VARCHAR(100),
  
  -- Severity index (computed)
  severity_index REAL, -- 0-1 derived from all factors
  
  -- Metadata
  source VARCHAR(50), -- 'open_meteo', 'tomorrow_io'
  confidence REAL,
  timestamp TIMESTAMP DEFAULT NOW(),
  data_age_minutes INT, -- How old is the source data
  
  CONSTRAINT valid_temp CHECK (temperature > -50 AND temperature < 60),
  CONSTRAINT valid_rain CHECK (rain_mm >= 0),
  CONSTRAINT valid_wind CHECK (wind_speed >= 0)
);

CREATE INDEX idx_weather_city_time ON weather_snapshots(city, timestamp DESC);
CREATE INDEX idx_weather_grid_time ON weather_snapshots(grid_cell_id, timestamp DESC);
```

#### aqi_snapshots
```sql
CREATE TABLE aqi_snapshots (
  id SERIAL PRIMARY KEY,
  city VARCHAR(50),
  latitude REAL,
  longitude REAL,
  grid_cell_id VARCHAR(20),
  
  -- Primary metrics
  aqi INT, -- 0-500+ scale
  pm2_5 REAL,
  pm10 REAL,
  o3 REAL,
  no2 REAL,
  so2 REAL,
  co REAL,
  
  -- Derived indices
  health_concern_level VARCHAR(20), -- 'Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Hazardous'
  heat_stress_score REAL, -- 0-1 impact on worker
  respiratory_risk_score REAL, -- 0-1
  
  -- Metadata
  source VARCHAR(50), -- 'openaq', 'open_meteo'
  sensor_quality INT, -- 1-5 rating
  data_completeness REAL, -- % of pollutants measured
  timestamp TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_aqi CHECK (aqi >= 0),
  CONSTRAINT valid_pm CHECK (pm2_5 >= 0 AND pm10 >= 0)
);

CREATE INDEX idx_aqi_city_time ON aqi_snapshots(city, timestamp DESC);
CREATE INDEX idx_aqi_grid_time ON aqi_snapshots(grid_cell_id, timestamp DESC);
```

#### traffic_snapshots
```sql
CREATE TABLE traffic_snapshots (
  id SERIAL PRIMARY KEY,
  route_id VARCHAR(100),
  origin_lat REAL,
  origin_lon REAL,
  dest_lat REAL,
  dest_lon REAL,
  
  -- Current traffic state
  distance_km REAL,
  duration_minutes_free_flow REAL, -- baseline
  duration_minutes_current REAL, -- actual current
  delay_ratio REAL, -- current / free_flow
  congestion_index REAL, -- 0-1 where 1 = complete gridlock
  
  -- Directional info
  direction VARCHAR(20), -- 'north_bound', 'south_bound', etc
  road_type VARCHAR(20), -- 'highway', 'arterial', 'local'
  
  -- Flags
  has_incidents BOOLEAN,
  incident_type VARCHAR(50), -- 'accident', 'construction', 'event'
  incident_duration_minutes INT,
  
  -- Metadata
  source VARCHAR(50), -- 'mapbox', 'here', 'google'
  confidence REAL,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_ratio CHECK (delay_ratio >= 1.0),
  CONSTRAINT valid_congestion CHECK (congestion_index >= 0 AND congestion_index <= 1)
);

CREATE INDEX idx_traffic_route_time ON traffic_snapshots(route_id, timestamp DESC);
CREATE INDEX idx_traffic_origin_time ON traffic_snapshots(origin_lat, origin_lon, timestamp DESC);
```

---

### 2. FEATURE STORE (Pre-computed Features for Models)

```sql
CREATE TABLE feature_vectors (
  id SERIAL PRIMARY KEY,
  worker_email VARCHAR(100),
  shift_date DATE,
  shift_hour INT, -- 0-23
  
  -- Weather features
  temp REAL,
  rain_mm REAL,
  rain_probability INT,
  wind_speed REAL,
  weather_severity_index REAL,
  
  -- AQI features
  aqi INT,
  pm2_5 REAL,
  health_concern_level VARCHAR(20),
  
  -- Traffic features
  expected_delay_ratio REAL,
  typical_congestion_index REAL,
  
  -- Temporal features
  hour_of_day INT,
  day_of_week INT,
  is_peak_hour BOOLEAN,
  is_weekend BOOLEAN,
  
  -- Worker history
  worker_tenure_days INT,
  worker_shift_count INT,
  worker_claim_frequency REAL, -- claims per 100 shifts
  worker_fraud_score REAL, -- historical
  
  -- Location features
  city VARCHAR(50),
  zone_type VARCHAR(20), -- 'high_traffic', 'low_traffic', 'downtown'
  altitude_m INT,
  
  -- Target variable (for training)
  disruption_occurred BOOLEAN,
  disruption_severity INT, -- 0-3 (none, minor, moderate, severe)
  actual_claim_amount INT,
  frames_completed_pct INT, -- 0-100
  
  -- Feature version for reproducibility
  feature_version VARCHAR(20), -- v1, v2, etc
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_probability CHECK (rain_probability >= 0 AND rain_probability <= 100)
);

CREATE INDEX idx_feature_worker_date ON feature_vectors(worker_email, shift_date);
CREATE INDEX idx_feature_city_date ON feature_vectors(city, shift_date);
```

---

### 3. MODEL PREDICTIONS & DECISIONS

```sql
CREATE TABLE model_predictions (
  id SERIAL PRIMARY KEY,
  worker_email VARCHAR(100),
  shift_date DATE,
  shift_hour INT,
  
  -- Model metadata
  model_version VARCHAR(20), -- risk_v2_3, fraud_v1_1
  feature_vector_id INT REFERENCES feature_vectors(id),
  feature_version VARCHAR(20),
  
  -- Risk prediction
  risk_score REAL, -- 0-1
  risk_level VARCHAR(20), -- LOW, MEDIUM, HIGH
  risk_confidence REAL,
  risk_class_probabilities JSON, -- {"low": 0.1, "medium": 0.3, "high": 0.6}
  
  -- Fraud scoring
  fraud_score REAL, -- 0-1 (isolation forest + rule flags)
  fraud_risk_level VARCHAR(20), -- LOW, MEDIUM, HIGH
  fraud_flags JSON, -- {"high_claim_freq": true, "location_mismatch": false}
  
  -- Severity/payout prediction
  predicted_payout_amount INT, -- ₹ (only if claim triggered)
  predicted_payout_band VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'
  
  -- Explainability
  top_risk_factors JSON, -- [{"name": "rain_probability", "contribution": 0.35, "direction": "increase"}]
  top_fraud_factors JSON,
  human_explanation TEXT, -- "High risk due to heavy rain (40%) and traffic (30%)"
  
  -- Latency
  prediction_latency_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictions_worker_date ON model_predictions(worker_email, shift_date);
```

```sql
CREATE TABLE final_decisions (
  id SERIAL PRIMARY KEY,
  worker_email VARCHAR(100),
  shift_date DATE,
  
  -- Input references
  model_prediction_id INT REFERENCES model_predictions(id),
  
  -- Decision output
  decision_type VARCHAR(50), -- 'coverage_active', 'coverage_denied', 'manual_review'
  coverage_tier VARCHAR(20), -- 'basic', 'plus', 'premium'
  
  -- Policy application
  auto_claim_eligible BOOLEAN,
  fraud_review_required BOOLEAN,
  
  -- Action
  approved_payout_amount INT,
  override_reason TEXT, -- if manual overridden
  reviewed_by VARCHAR(100), -- admin email if manual review
  review_timestamp TIMESTAMP,
  
  -- Full audit trail
  decision_inputs JSON, -- All inputs to decision formula
  decision_formula_used VARCHAR(50), -- 'hybrid_60_40', 'fraud_flagged', etc
  confidence_score REAL,
  
  -- Outcome tracking (filled later)
  actual_disruption_occurred BOOLEAN,
  actual_claim_filed BOOLEAN,
  actual_claim_approved BOOLEAN,
  actual_payout_amount INT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  outcome_recorded_at TIMESTAMP
);

CREATE INDEX idx_decisions_worker_date ON final_decisions(worker_email, shift_date);
CREATE INDEX idx_decisions_review_required ON final_decisions(fraud_review_required, created_at DESC);
```

---

### 4. MODEL REGISTRY & METADATA

```sql
CREATE TABLE model_registry (
  id SERIAL PRIMARY KEY,
  model_type VARCHAR(20), -- 'risk', 'fraud', 'severity'
  model_name VARCHAR(50), -- 'risk_v2_3', 'fraud_v1_0'
  
  -- Model details
  algorithm VARCHAR(50), -- 'xgboost', 'isolation_forest', 'linear_regression'
  training_data_rows INT,
  training_window_start DATE,
  training_window_end DATE,
  training_completed_at TIMESTAMP,
  
  -- Performance metrics
  auc REAL,
  precision REAL,
  recall REAL,
  f1_score REAL,
  false_positive_rate REAL,
  calibration_error REAL,
  
  -- Fairness metrics (per city/group)
  fairness_metrics JSON, -- {"mumbai": {precision: 0.92, recall: 0.88}, ...}
  
  -- Drift metrics
  feature_drift_detected BOOLEAN,
  prediction_drift_detected BOOLEAN,
  calibration_drift_detected BOOLEAN,
  
  -- Status
  status VARCHAR(20), -- 'training', 'champion', 'challenger', 'archived'
  is_production BOOLEAN,
  promoted_to_prod_at TIMESTAMP,
  
  -- Lineage
  parent_model_id INT REFERENCES model_registry(id),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_model_type_status ON model_registry(model_type, status);
```

---

### 5. DRIFT & MONITORING

```sql
CREATE TABLE drift_events (
  id SERIAL PRIMARY KEY,
  model_id INT REFERENCES model_registry(id),
  drift_type VARCHAR(50), -- 'feature_drift', 'prediction_drift', 'calibration_drift'
  
  -- Detection details
  affected_features JSON, -- ["rain_mm", "traffic_delay_ratio"]
  statistical_test_used VARCHAR(50), -- 'kolmogorov_smirnov', 'wasserstein'
  p_value REAL,
  drift_magnitude REAL,
  
  -- Alert info
  alert_severity VARCHAR(20), -- 'warning', 'critical'
  action_taken VARCHAR(100), -- 'rollback', 'retrain', 'monitor'
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drift_model_time ON drift_events(model_id, created_at DESC);
```

---

### 6. FAIRNESS ANALYSIS

```sql
CREATE TABLE fairness_slices (
  id SERIAL PRIMARY KEY,
  model_id INT REFERENCES model_registry(id),
  
  slice_name VARCHAR(50), -- 'mumbai', 'delhi_night', 'new_workers'
  slice_filter JSON, -- {"city": "Mumbai"}
  
  -- Slice metrics
  sample_count INT,
  precision REAL,
  recall REAL,
  false_positive_rate REAL,
  false_negative_rate REAL,
  
  -- Disparity vs overall
  precision_disparity REAL, -- % difference from overall
  recall_disparity REAL,
  
  -- Alert
  disparity_exceeds_threshold BOOLEAN,
  
  evaluated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fairness_model_slice ON fairness_slices(model_id, slice_name);
```

---

### 7. RETRAINING LOGS & PIPELINE

```sql
CREATE TABLE retraining_jobs (
  id SERIAL PRIMARY KEY,
  model_type VARCHAR(20),
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  status VARCHAR(20), -- 'queued', 'running', 'success', 'failed'
  data_rows_used INT,
  training_duration_seconds INT,
  
  -- Result
  new_model_id INT REFERENCES model_registry(id),
  improvement_vs_current REAL, -- % AUC improvement
  
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_retraining_model_type_time ON retraining_jobs(model_type, created_at DESC);
```

---

## Modified Existing Tables

### users
```sql
-- Add columns to track worker ML features
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  worker_tenure_days INT DEFAULT 0,
  worker_claim_frequency REAL DEFAULT 0.0,
  worker_fraud_score REAL DEFAULT 0.0,
  worker_reliability_score REAL DEFAULT 1.0,
  ml_persona_type VARCHAR(50), -- Dynamic persona from live conditions
  model_version_at_registration VARCHAR(20);
```

### risk_data (modified from earlier)
```sql
-- Already has extended fields, but ensure these exist:
ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS
  traffic_delay_ratio REAL,
  route_duration_minutes INT,
  feature_vector_id INT REFERENCES feature_vectors(id),
  model_prediction_id INT REFERENCES model_predictions(id),
  decision_id INT REFERENCES final_decisions(id);
```

---

## Index Strategy for Query Performance

```sql
-- High-priority indexes
CREATE INDEX idx_weather_city_time ON weather_snapshots(city, timestamp DESC);
CREATE INDEX idx_aqi_city_time ON aqi_snapshots(city, timestamp DESC);
CREATE INDEX idx_feature_worker_date ON feature_vectors(worker_email, shift_date);
CREATE INDEX idx_predictions_worker_date ON model_predictions(worker_email, shift_date);
CREATE INDEX idx_decisions_worker_date ON final_decisions(worker_email, shift_date);
CREATE INDEX idx_decisions_review ON final_decisions(fraud_review_required, created_at);

-- For admin dashboards
CREATE INDEX idx_decisions_status_time ON final_decisions(fraud_review_required, created_at DESC);
CREATE INDEX idx_drift_model_time ON drift_events(model_id, created_at DESC);
```

---

## Data Retention Policy (90 days raw, 1 year aggregates)

```sql
-- Archive raw data older than 90 days (run daily)
DELETE FROM weather_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';
DELETE FROM aqi_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';
DELETE FROM traffic_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';

-- Keep aggregated feature vectors for 1 year
DELETE FROM feature_vectors WHERE created_at < NOW() - INTERVAL '1 year';

-- Keep model decisions indefinitely (for audit)
-- DELETE FROM final_decisions -- NEVER delete for audit trail
```

