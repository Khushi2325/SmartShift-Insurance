#!/usr/bin/env python3
"""
ML Service API - Real-time risk prediction with XGBoost + SHAP
Integrates with Node.js backend at /api/ml/risk endpoint
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import traceback

# Add ml_models to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml_models'))

# Import ML model
from ml_models.risk_model import get_predictor
from data_pipeline import DataCollector

# Create Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global predictor instance
predictor = None

@app.before_request
def init_predictor():
    """Initialize predictor on first request"""
    global predictor
    if predictor is None:
        logger.info("🚀 Initializing ML predictor...")
        predictor = get_predictor()
        logger.info("✅ ML predictor ready")

# ============================================================================
# CORE PREDICTION ENDPOINT
# ============================================================================

@app.route('/api/ml/risk', methods=['POST'])
def predict_risk():
    """
    Real-time risk prediction using XGBoost + SHAP
    
    Input:
    {
        "city": "Mumbai",
        "lat": 19.0760,
        "lon": 72.8777,
        "weather": { "rain": 0.2, "wind": 0.3, ... },
        "aqi": 75
    }
    
    Output:
    {
        "risk_score": 0.72,
        "risk_level": "HIGH",
        "explanation": [
            {"feature": "rain", "contribution": 0.15, "direction": "increased"},
            ...
        ],
        "model_info": {
            "type": "XGBoost",
            "training_data": "Real API data (hybrid labels)",
            "version": "1.0"
        }
    }
    """
    try:
        payload = request.json or {}
        
        # Get city for data collection
        city = payload.get('city', 'Mumbai')
        
        # Option 1: Use provided features
        if 'weather' in payload:
            features = {
                "rain": float(payload['weather'].get('rain', 0)),
                "wind": float(payload['weather'].get('wind', 0)),
                "temperature": float(payload['weather'].get('temperature', 25)),
                "aqi": float(payload['weather'].get('aqi', 75)),
                "traffic": float(payload.get('traffic', {}).get('delay_ratio', 0)),
                "hour": float(payload.get('hour_of_day', datetime.now().hour) / 24),
            }
        # Option 2: Fetch real data from APIs
        else:
            logger.info(f"📊 Fetching real data for {city}...")
            features = DataCollector.collect_features(city)
        
        # Run prediction
        logger.info(f"🔮 Predicting risk for {city}...")
        result = predictor.predict(features)
        
        # Build response
        response = {
            "city": city,
            "risk_score": result['score'],
            "risk_level": result['level'],
            "confidence": result['confidence'],
            "class_probabilities": result['probabilities'],
            "explanation": result['explanation'],
            "model_info": {
                "type": "XGBoost",
                "training_data": "Real API data with simulated labels",
                "features_used": ["rain", "wind", "temperature", "aqi", "traffic", "hour"],
                "version": "1.0"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"✅ Risk prediction: {result['score']:.3f} ({result['level']})")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# ============================================================================
# MODEL STATUS ENDPOINT
# ============================================================================

@app.route('/api/ml/status', methods=['GET'])
def get_status():
    """Get ML service status"""
    try:
        status = {
            "service": "shift-shield-ml",
            "status": "ready" if predictor and predictor.model else "initializing",
            "model_type": "XGBoost with SHAP",
            "model_loaded": predictor is not None and predictor.model is not None,
            "shap_available": predictor is not None and predictor.explainer is not None,
            "timestamp": datetime.utcnow().isoformat()
        }
        return jsonify(status), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================================
# BATCH PREDICTION ENDPOINT
# ============================================================================

@app.route('/api/ml/batch-predict', methods=['POST'])
def batch_predict():
    """Predict risk for multiple locations"""
    try:
        payload = request.json or {}
        locations = payload.get('locations', [])
        
        results = []
        for loc in locations:
            features = {
                "rain": float(loc.get('rain', 0)),
                "wind": float(loc.get('wind', 0)),
                "temperature": float(loc.get('temperature', 25)),
                "aqi": float(loc.get('aqi', 75)),
                "traffic": float(loc.get('traffic', 0)),
                "hour": float(loc.get('hour', 0.5)),
            }
            
            result = predictor.predict(features)
            results.append({
                "city": loc.get('city', 'Unknown'),
                "risk_score": result['score'],
                "risk_level": result['level']
            })
        
        return jsonify({
            "results": results,
            "count": len(results),
            "timestamp": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok"}), 200

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('ML_SERVICE_PORT', 5001))
    logger.info(f"🚀 Starting ML service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
