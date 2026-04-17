"""
Flask API Server for ML Risk Predictions
Serves trained XGBoost model with SHAP explainability
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add models to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml_models'))

from predictor import get_predictor

app = Flask(__name__)
CORS(app)

# Initialize predictor
print("🚀 Initializing ML Predictor...")
predictor = get_predictor()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    model_loaded = predictor.model is not None
    return jsonify({
        "status": "healthy" if model_loaded else "model_not_loaded",
        "model_ready": model_loaded
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict risk with SHAP explainability
    
    Expected body:
    {
        "rain": float,
        "rain_prob": float,
        "wind": float,
        "temperature": float,
        "aqi": float,
        "traffic_delay": float,
        "hour": int
    }
    """
    try:
        features = request.get_json()
        
        if not features:
            return jsonify({"error": "No features provided"}), 400
        
        # Get prediction with explanation
        result = predictor.predict(features)
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """Batch predictions"""
    try:
        features_list = request.get_json()
        
        if not isinstance(features_list, list):
            return jsonify({"error": "Expected list of feature dictionaries"}), 400
        
        results = []
        for features in features_list:
            result = predictor.predict(features)
            results.append(result)
        
        return jsonify({
            "success": True,
            "count": len(results),
            "data": results
        })
    
    except Exception as e:
        print(f"❌ Batch prediction error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/info', methods=['GET'])
def info():
    """Get model information"""
    return jsonify({
        "model": "XGBoost Risk Predictor",
        "features": predictor.feature_names if predictor.feature_names else [],
        "explainability": "SHAP",
        "version": "1.0"
    })

if __name__ == '__main__':
    print(f"📦 ML Predictor API starting on port 5001...")
    print(f"✓ Model loaded: {predictor.model is not None}")
    print(f"✓ Explainer loaded: {predictor.explainer is not None}")
    print("\n🔗 Available endpoints:")
    print("  GET  /health")
    print("  GET  /info")
    print("  POST /predict")
    print("  POST /predict-batch")
    app.run(host='0.0.0.0', port=5001, debug=False)
