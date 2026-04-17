# 🤖 AI-Ready Insurance System - Complete Implementation Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [API Documentation](#api-documentation)
5. [Model Training](#model-training)
6. [Deployment](#deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Overview

This is a **complete ML-powered risk assessment system** for Shift Shield that predicts:
- ✅ **Risk Score** (disruption probability) - XGBoost model
- ✅ **Fraud Score** - Isolation Forest + Rule-based flags
- ✅ **Payout Severity** - Regression model
- ✅ **Explainability** - SHAP-based feature attribution
- ✅ **Fairness Monitoring** - Per-city performance slices

---

## Architecture

```
┌─────────────────────┐
│  Browser (React)    │
│  Worker Dashboard   │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────────────────────┐
│  Node.js Backend (Express)          │
│  ├─ API Routes (/api/ml/*)          │
│  ├─ Data Collection                 │
│  ├─ Database (PostgreSQL)           │
│  └─ ML Service Client               │
└──────────────┬──────────────────────┘
               │ gRPC/REST
               ▼
┌─────────────────────────────────────┐
│  Python ML Service (Flask)          │ ← Deploy on Render
│  ├─ Risk Model (XGBoost)            │
│  ├─ Fraud Model (Isolation Forest)  │
│  ├─ Severity Model                  │
│  ├─ SHAP Explainer                  │
│  ├─ Feature Engineer                │
│  └─ Model Registry + MLOps          │
└─────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  External APIs (Open-Meteo, etc)     │
│  ├─ Weather Data                     │
│  ├─ AQI Data                         │
│  └─ Traffic Data                     │
└──────────────────────────────────────┘
```

---

## Setup Instructions

### Part 1: Python ML Service - Local Development

#### 1.1 Create Python Environment

```bash
# Navigate to ML service directory
cd ml_service

# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 1.2 Create Configuration

Create `.env` file in `ml_service/`:

```env
# Flask
FLASK_ENV=development
PORT=5001

# Redis (for caching)
REDIS_URL=redis://localhost:6379/0

# Node Backend
NODE_BACKEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shiftshield

# Logging
LOG_LEVEL=INFO
LOG_FILE=./logs/ml_service.log
```

#### 1.3 Initialize Directories

```bash
mkdir -p models logs data
```

#### 1.4 Generate Synthetic Training Data

```python
# Create train_models.py
from ml_service.utils.cache import SyntheticDataGenerator
from ml_service.feature_engine.feature_engineer import FeatureEngineer

# Generate dataset
dataset = SyntheticDataGenerator.generate_dataset(n_samples=5000)

# Convert to training features
fe = FeatureEngineer()
df = fe.create_training_dataset(dataset)

# Save to CSV for model training
df.to_csv('data/training_data.csv', index=False)
print(f'✓ Generated {len(df)} training samples')
```

#### 1.5 Train Models

```python
# Create train_all_models.py
import pandas as pd
from ml_service.ml_models.risk_model import RiskPredictor
from ml_service.ml_models.fraud_model import FraudDetector, SeverityPredictor

# Load training data
df = pd.read_csv('data/training_data.csv')

# Train risk model
print('Training risk model...')
risk_model = RiskPredictor()
risk_model.retrain(df)

# Train fraud model
print('Training fraud model...')
fraud_model = FraudDetector()
fraud_model.retrain(df[['worker_claim_frequency', 'worker_tenure_days', 
                        'expected_delay_ratio', 'aqi', 'rain_probability']].values)

# Train severity model
print('Training severity model...')
severity_model = SeverityPredictor()
severity_model.retrain(df)

print('✓ All models trained successfully!')
```

#### 1.6 Run ML Service Locally

```bash
python app.py

# Should output:
# * Running on http://0.0.0.0:5001
# ✓ Models loaded successfully
```

Test health check:
```bash
curl http://localhost:5001/health
```

---

### Part 2: Node.js Backend Integration

#### 2.1 Update server/index.js

```javascript
import mlRoutes from './routes/mlRoutes.js';
import { createMLMiddleware } from '../src/lib/mlServiceClient.ts';

// Add middleware
app.use(createMLMiddleware());

// Add routes
app.use('/api/ml', mlRoutes);

// Initialize database schema
await ensureAiSchema();

console.log('✓ ML integration initialized');
```

#### 2.2 Run Database Migrations

```bash
# In Node backend directory
node -e "import('./lib/db/aiSchemaMigration.ts').then(m => m.ensureAiSchema())"

# Should output:
# 🔄 Migrating AI schema...
# ✓ weather_snapshots table created
# ✓ aqi_snapshots table created
# ... (all tables)
# ✅ AI schema migration complete!
```

#### 2.3 Test ML Integration

```bash
# Start both services
# Terminal 1: ML service
cd ml_service && python app.py

# Terminal 2: Node backend
npm run dev

# Terminal 3: Test endpoint
curl -X POST http://localhost:3000/api/ml/assess-risk \
  -H "Content-Type: application/json" \
  -d '{
    "worker_email": "test@example.com",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "city": "Mumbai"
  }'

# Should return comprehensive risk assessment
```

---

## API Documentation

### Main Endpoints

#### 1. Assess Risk
```
POST /api/ml/assess-risk

Request:
{
  "worker_email": "worker@example.com",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "city": "Mumbai",
  "destination_latitude": 19.1136,
  "destination_longitude": 72.8697
}

Response:
{
  "success": true,
  "assessment": {
    "risk": {
      "score": 0.62,
      "level": "MEDIUM",
      "confidence": 0.85,
      "class_probabilities": {
        "low": 0.15,
        "medium": 0.35,
        "high": 0.50
      }
    },
    "fraud": {
      "score": 0.12,
      "level": "LOW",
      "flags": {
        "high_claim_frequency": false,
        "suspicious_new_worker": false
      }
    },
    "severity": {
      "payout_band": "MEDIUM",
      "expected_amount": 550
    },
    "explanation": {
      "top_factors": [
        {
          "name": "rain_probability",
          "contribution": 0.35,
          "direction": "increase",
          "explanation": "High rainfall probability increases disruption risk"
        }
      ],
      "human_readable": "High risk (0.62) due to heavy rain (40%), traffic congestion (30%)"
    },
    "decision": {
      "auto_approve": true,
      "manual_review_required": false,
      "recommended_action": "Conditions moderately risky - be cautious"
    },
    "latency_ms": 145
  }
}
```

#### 2. Check Fraud
```
POST /api/ml/check-fraud

Request:
{
  "worker_email": "worker@example.com",
  "claim_history": [
    {
      "claim_date": "2024-01-15",
      "lat": 19.0760,
      "lon": 72.8777,
      "amount": 500
    }
  ],
  "location_data": {...}
}
```

#### 3. Model Statistics
```
GET /api/ml/model-stats

Response:
{
  "risk_model": {
    "version": "risk_v1_0",
    "auc": 0.87,
    "precision": 0.89,
    "recall": 0.84
  },
  "fraud_model": {
    "version": "fraud_v1_0",
    "auc": 0.92
  }
}
```

#### 4. Fairness Report
```
GET /api/ml/fairness-report

Response:
{
  "fairness_slices": {
    "mumbai": {
      "precision": 0.91,
      "recall": 0.87,
      "disparity": "PASS"
    },
    "vadodara": {
      "precision": 0.89,
      "recall": 0.86,
      "disparity": "PASS"
    }
  }
}
```

---

## Model Training

### Weekly Retraining Schedule

```python
# ml_service/train_scheduler.py
import schedule
import time
from ml_service.ml_models.risk_model import RiskPredictor

def retrain_models():
    """Run weekly model retraining"""
    print('[RETRAIN] Starting weekly model update...')
    
    # Fetch latest data from PostgreSQL
    df = fetch_training_data(days=30)  # Last 30 days
    
    # Retrain all models
    risk_model = RiskPredictor()
    risk_model.retrain(df)
    
    # Save new model
    risk_model.save()
    
    print('[RETRAIN] ✓ Models updated successfully')

# Schedule for Monday 2 AM
schedule.every().monday.at("02:00").do(retrain_models)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## Deployment

### Deploy to Render (Recommended for ML Service)

#### 1. Create Render Service

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name**: shiftshield-ml
   - **Environment**: Python 3.9
   - **Build command**: `pip install -r ml_service/requirements.txt`
   - **Start command**: `cd ml_service && gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Plan**: Free tier (or Pay-as-you-go)

#### 2. Environment Variables

```env
FLASK_ENV=production
REDIS_URL=<redis-url>
DATABASE_URL=<postgresql-url>
PORT=10000
```

#### 3. Update Node Backend

```javascript
// In server/index.js
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://shiftshield-ml.onrender.com';
```

#### 4. Deploy Node Backend (Existing Provider)

Update ML_SERVICE_URL in your deployment environment.

---

## Monitoring & Maintenance

### 1. Model Performance Monitoring

```javascript
// Daily monitoring job
setInterval(async () => {
  const stats = await mlClient.getModelStats();
  
  if (stats.auc < 0.80) {
    console.warn('⚠️  MODEL PERFORMANCE DEGRADED');
    // Send alert to admin
  }
}, 24 * 60 * 60 * 1000);
```

### 2. Drift Detection

```javascript
const drift = await mlClient.checkDrift();

if (drift.feature_drift.detected) {
  logger.alert('Feature drift detected! Scheduling retrain...');
  await mlClient.triggerRetrain('all');
}
```

### 3. Fairness Audits

```javascript
const fairness = await mlClient.getFairnessReport();

for (const [city, metrics] of Object.entries(fairness.fairness_slices)) {
  if (metrics.precision_disparity > 0.05) {
    logger.warn(`Fairness alert: ${city} has ${metrics.precision_disparity} disparity`);
  }
}
```

### 4. Database Maintenance

```sql
-- Daily: Clean up old data (90-day retention)
DELETE FROM weather_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';
DELETE FROM aqi_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';
DELETE FROM traffic_snapshots WHERE timestamp < NOW() - INTERVAL '90 days';

-- Keep model predictions for 1 year (audit trail)
-- (Never delete final_decisions)
```

---

## Key Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| **Risk Model AUC** | > 0.85 | - |
| **Fraud Detection Rate** | > 90% | - |
| **False Positive Rate** | < 5% | - |
| **Prediction Latency** | < 200ms | - |
| **Manual Review Rate** | < 20% | - |
| **Fairness Disparity** | < 5% | - |
| **Model Retraining Frequency** | Weekly | - |
| **Drift Alert Threshold** | p<0.05 | - |

---

## Success Criteria for Demo

✅ **Complete When:**
- [ ] Risk model trained with AUC > 0.85
- [ ] Fraud detection flags working (high_claim_freq, suspicious_new_worker, etc)
- [ ] SHAP explanations generating human-readable text
- [ ] Auto-claim working for fraud_score < 0.3
- [ ] Fairness slices showing per-city performance
- [ ] Live dashboard showing dynamic risk updatesfrom worker DB
- [ ] ML models update weekly via scheduler
- [ ] Drift detection triggering alerts

---

## Production Checklist

- [ ] All models trained on real data
- [ ] Redis cache deployed
- [ ] Database backups enabled
- [ ] Monitoring alerts configured
- [ ] Fairness audits passing
- [ ] Rate limiting on ML endpoints
- [ ] Secrets management (API keys, DB URLs)
- [ ] CORS/CSRF security headers
- [ ] Model versioning scheme established
- [ ] Rollback procedure documented

---

Let's build the future of injury-free gig work! 🚀🛡️
