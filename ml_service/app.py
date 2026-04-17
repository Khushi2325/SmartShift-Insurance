#!/usr/bin/env python3
"""
SmartShift AI Service - Main Flask Application
Handles real-time risk prediction, fraud detection, and explainability
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from typing import Dict, Tuple, Any

# Import ML modules (to be created next)
from ml_models.risk_model import RiskPredictor
from ml_models.fraud_model import FraudDetector
from ml_models.severity_model import SeverityPredictor
from ml_models.explainability import ExplainerSHAP
from feature_engine.feature_engineer import FeatureEngineer
from utils.cache import RedisCache
from utils.logger import setup_logger

# Initialize Flask
app = Flask(__name__)
CORS(app)

# Setup logging
logger = setup_logger(__name__)

# Global ML components
risk_predictor = None
fraud_detector = None
severity_predictor = None
explainer = None
feature_engineer = None
cache = None

# Configuration
ML_MODEL_DIR = os.getenv('ML_MODEL_DIR', './models')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
NODE_BACKEND_URL = os.getenv('NODE_BACKEND_URL', 'http://localhost:5000')
CITIES = ['Mumbai', 'Vadodara', 'Delhi', 'Bangalore', 'Chennai']

# ============================================================================
# INITIALIZATION
# ============================================================================

@app.before_request
def initialize():
    """Initialize ML models on first request"""
    global risk_predictor, fraud_detector, severity_predictor, explainer, feature_engineer, cache
    
    if risk_predictor is None:
        logger.info('🚀 Initializing ML models...')
        
        try:
            risk_predictor = RiskPredictor(model_dir=ML_MODEL_DIR)
            fraud_detector = FraudDetector(model_dir=ML_MODEL_DIR)
            severity_predictor = SeverityPredictor(model_dir=ML_MODEL_DIR)
            explainer = ExplainerSHAP(risk_predictor.model)
            feature_engineer = FeatureEngineer()
            cache = RedisCache(REDIS_URL)
            
            logger.info('✅ Models loaded successfully')
        except Exception as e:
            logger.error(f'❌ Failed to initialize models: {e}')
            app.config['MODELS_READY'] = False
            return
        
        app.config['MODELS_READY'] = True

# ============================================================================
# CORE PREDICTION ENDPOINT
# ============================================================================

@app.route('/api/ml/predict', methods=['POST'])
def predict_risk():
    """
    Main prediction endpoint
    Input: worker_email, location, weather, traffic, historical data
    Output: risk_score, fraud_score, payout, explanation
    """
    
    if not app.config.get('MODELS_READY', False):
        return jsonify({'error': 'Models not ready'}), 503
    
    try:
        payload = request.json
        
        # Extract features
        worker_email = payload.get('worker_email')
        location = payload.get('location')  # {lat, lon, city}
        weather = payload.get('weather')    # {temp, rain_mm, rain_prob, wind, aqi}
        traffic = payload.get('traffic')    # {delay_ratio, congestion_index}
        worker_history = payload.get('worker_history')  # {tenure, claims, fraud_score}
        
        # Validate required fields
        if not all([worker_email, location, weather]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check cache
        cache_key = f"prediction:{worker_email}:{location['lat']}:{location['lon']}"
        cached = cache.get(cache_key)
        if cached:
            logger.info(f'✓ Cache hit for {worker_email}')
            return jsonify(cached)
        
        # Generate feature vector
        start_time = datetime.utcnow()
        features = feature_engineer.extract_features(
            location=location,
            weather=weather,
            traffic=traffic,
            worker_history=worker_history,
            time_of_day=datetime.utcnow().hour,
            day_of_week=datetime.utcnow().weekday()
        )
        
        logger.info(f'Features engineered: {features}')
        
        # Run predictions
        risk_output = risk_predictor.predict(features)
        fraud_output = fraud_detector.predict(features)
        severity_output = severity_predictor.predict(features)
        
        # Get explainability
        shap_explanation = explainer.explain(features)
        human_explanation = explainer.to_natural_language(shap_explanation, risk_output)
        
        # Apply hybrid decision logic (60% AI + 40% rules)
        final_risk_score, confidence = apply_hybrid_decision(
            ai_score=risk_output['score'],
            rules_score=calculate_rules_score(weather, traffic),
            weight_ai=0.6,
            weight_rules=0.4
        )
        
        # Determine payout band
        payout_band = determine_payout_band(risk_score=final_risk_score)
        
        # Build response
        response = {
            'worker_email': worker_email,
            'predictions': {
                'risk': {
                    'score': float(final_risk_score),
                    'level': risk_output['level'],
                    'confidence': float(confidence),
                    'class_probabilities': risk_output['probabilities']
                },
                'fraud': {
                    'score': float(fraud_output['score']),
                    'level': fraud_output['level'],
                    'flags': fraud_output['flags']
                },
                'severity': {
                    'payout_band': payout_band,
                    'expected_amount': severity_output['payout_amount']
                }
            },
            'explainability': {
                'top_factors': shap_explanation['top_factors'],
                'human_readable': human_explanation,
                'feature_contributions': shap_explanation['contributions']
            },
            'decision': {
                'auto_approve': should_auto_approve(fraud_output['score']),
                'manual_review_required': fraud_output['score'] > 0.3,
                'recommended_action': get_recommended_action(final_risk_score, fraud_output['score'])
            },
            'timestamp': datetime.utcnow().isoformat(),
            'latency_ms': int((datetime.utcnow() - start_time).total_seconds() * 1000)
        }
        
        # Cache result
        cache.set(cache_key, response, ttl=300)  # 5 min TTL
        
        logger.info(f'✓ Prediction complete for {worker_email}: risk={final_risk_score:.2f}')
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f'❌ Prediction failed: {e}', exc_info=True)
        return jsonify({'error': str(e)}), 500

# ============================================================================
# FRAUD DETECTION ENDPOINT
# ============================================================================

@app.route('/api/ml/fraud-check', methods=['POST'])
def check_fraud():
    """Detailed fraud analysis"""
    try:
        payload = request.json
        worker_email = payload.get('worker_email')
        claim_history = payload.get('claim_history')
        location_data = payload.get('location_data')
        
        result = fraud_detector.detailed_analysis(
            worker_email=worker_email,
            claim_history=claim_history,
            location_data=location_data
        )
        
        return jsonify(result), 200
    except Exception as e:
        logger.error(f'Fraud check failed: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================================================
# MODEL MONITORING & MANAGEMENT
# ============================================================================

@app.route('/api/ml/model-stats', methods=['GET'])
def get_model_stats():
    """Get current model performance stats"""
    try:
        stats = {
            'risk_model': {
                'version': risk_predictor.version,
                'auc': risk_predictor.auc,
                'precision': risk_predictor.precision,
                'recall': risk_predictor.recall,
                'last_trained': risk_predictor.last_trained
            },
            'fraud_model': {
                'version': fraud_detector.version,
                'auc': fraud_detector.auc,
                'last_trained': fraud_detector.last_trained
            },
            'severity_model': {
                'version': severity_predictor.version,
                'last_trained': severity_predictor.last_trained
            }
        }
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/drift-check', methods=['GET'])
def check_drift():
    """Check for feature drift or prediction drift"""
    try:
        drift_results = {
            'feature_drift': risk_predictor.check_feature_drift(),
            'prediction_drift': risk_predictor.check_prediction_drift(),
            'timestamp': datetime.utcnow().isoformat()
        }
        return jsonify(drift_results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/retrain', methods=['POST'])
def trigger_retrain():
    """Trigger model retraining with latest data"""
    try:
        model_type = request.json.get('model_type', 'all')  # 'risk', 'fraud', 'all'
        
        logger.info(f'Starting retraining for {model_type}...')
        
        if model_type in ['risk', 'all']:
            risk_predictor.retrain()
        if model_type in ['fraud', 'all']:
            fraud_detector.retrain()
        if model_type in ['severity', 'all']:
            severity_predictor.retrain()
        
        return jsonify({'status': 'Retraining completed'}), 200
    except Exception as e:
        logger.error(f'Retrain failed: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================================================
# FAIRNESS & MONITORING
# ============================================================================

@app.route('/api/ml/fairness-report', methods=['GET'])
def get_fairness_report():
    """Get fairness metrics per city and demographic"""
    try:
        report = risk_predictor.generate_fairness_report()
        return jsonify(report), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def apply_hybrid_decision(ai_score: float, rules_score: float, 
                         weight_ai: float = 0.6, weight_rules: float = 0.4) -> Tuple[float, float]:
    """
    Blend AI + Rules-based scoring
    Returns: (final_score, confidence)
    """
    final = (ai_score * weight_ai) + (rules_score * weight_rules)
    
    # Confidence is higher when both agree
    agreement = 1 - abs(ai_score - rules_score)
    confidence = (agreement * 0.5) + 0.5  # 0.5-1.0 range
    
    return min(1.0, final), confidence

def calculate_rules_score(weather: Dict, traffic: Dict) -> float:
    """Simple rule-based risk scoring"""
    score = 0.0
    
    # Rain rules
    if weather.get('rain_probability', 0) > 70:
        score += 0.2
    if weather.get('rain_mm', 0) > 20:
        score += 0.2
    
    # AQI rules
    if weather.get('aqi', 100) > 150:
        score += 0.15
    
    # Temperature
    if weather.get('temperature', 25) > 38:
        score += 0.1
    
    # Traffic
    if traffic.get('delay_ratio', 1.0) > 1.5:
        score += 0.15
    
    return min(1.0, score)

def determine_payout_band(risk_score: float) -> str:
    """
    Map risk score to payout band
    Low: ₹100-300 (risk < 0.33)
    Medium: ₹300-800 (0.33 <= risk < 0.66)
    High: ₹800-2000 (risk >= 0.66)
    """
    if risk_score < 0.33:
        return 'LOW'
    elif risk_score < 0.66:
        return 'MEDIUM'
    else:
        return 'HIGH'

def should_auto_approve(fraud_score: float) -> bool:
    """Auto-approve if fraud score < 0.3"""
    return fraud_score < 0.3

def get_recommended_action(risk_score: float, fraud_score: float) -> str:
    """Get actionable recommendation for worker"""
    if fraud_score > 0.3:
        return 'Manual review required'
    
    if risk_score < 0.33:
        return 'Conditions safe to work'
    elif risk_score < 0.66:
        return 'Be cautious, moderate risk detected'
    else:
        return 'High risk - consider delaying shift'

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'models_ready': app.config.get('MODELS_READY', False),
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f'Internal error: {e}')
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5001)),
        debug=debug
    )
