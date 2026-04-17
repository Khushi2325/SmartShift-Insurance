"""
ML Model Prediction Service
Loads trained model + SHAP explainer
Provides risk predictions with explainability
"""

import joblib
import numpy as np
import os

class RiskPredictor:
    def __init__(self, model_path="ml_service/ml_models/risk_model.pkl"):
        """Initialize predictor with trained model and explainer"""
        self.model_path = model_path
        self.explainer_path = "ml_service/ml_models/shap_explainer.pkl"
        self.feature_names_path = "ml_service/ml_models/feature_names.pkl"
        
        self.model = None
        self.explainer = None
        self.feature_names = None
        self.load_model()
    
    def load_model(self):
        """Load model, explainer, and feature names"""
        if not os.path.exists(self.model_path):
            print(f"⚠️  Model not found at {self.model_path}")
            print("   Run: python ml_service/ml_models/train_model.py")
            self.model = None
            return
        
        try:
            self.model = joblib.load(self.model_path)
            print("✓ Loaded model")
            
            self.explainer = joblib.load(self.explainer_path)
            print("✓ Loaded SHAP explainer")
            
            self.feature_names = joblib.load(self.feature_names_path)
            print("✓ Loaded feature names")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model = None
    
    def predict(self, features_dict):
        """
        Predict risk for given features
        
        Args:
            features_dict: {
                "rain": float,
                "rain_prob": float,
                "wind": float,
                "temperature": float,
                "aqi": float,
                "traffic_delay": float,
                "hour": int
            }
        
        Returns:
            {
                "risk_probability": float (0-1),
                "risk_level": str ("LOW", "MEDIUM", "HIGH"),
                "confidence": float,
                "explanation": list of feature contributions
            }
        """
        if self.model is None:
            return {
                "risk_probability": 0.5,
                "risk_level": "MEDIUM",
                "confidence": 0.0,
                "explanation": []
            }
        
        try:
            # Convert dict to ordered array matching feature_names
            features_array = np.array([[
                features_dict.get("rain", 0),
                features_dict.get("rain_prob", 0),
                features_dict.get("wind", 5),
                features_dict.get("temperature", 25),
                features_dict.get("aqi", 100),
                features_dict.get("traffic_delay", 1.0),
                features_dict.get("hour", 12)
            ]])
            
            # Get probability prediction
            risk_prob = self.model.predict_proba(features_array)[0][1]
            
            # Determine risk level
            if risk_prob >= 0.7:
                risk_level = "HIGH"
            elif risk_prob >= 0.4:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"
            
            # Get SHAP explanation
            shap_values = self.explainer.shap_values(features_array)[0]
            
            explanation = []
            for feat_name, shap_val in zip(self.feature_names, shap_values):
                explanation.append({
                    "feature": feat_name,
                    "contribution": float(shap_val),
                    "impact": "increases" if shap_val > 0 else "decreases"
                })
            
            # Sort by absolute impact
            explanation.sort(key=lambda x: abs(x["contribution"]), reverse=True)
            
            # Confidence is how certain we are (inverse of prediction margin)
            margin = abs(risk_prob - 0.5) / 0.5
            confidence = min(1.0, margin)
            
            return {
                "risk_probability": float(risk_prob),
                "risk_level": risk_level,
                "confidence": float(confidence),
                "explanation": explanation[:5]  # Top 5 features
            }
        
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return {
                "risk_probability": 0.5,
                "risk_level": "MEDIUM",
                "confidence": 0.0,
                "explanation": []
            }

# Global predictor instance
_predictor = None

def get_predictor():
    """Get or create global predictor instance"""
    global _predictor
    if _predictor is None:
        _predictor = RiskPredictor()
    return _predictor

def predict_risk(features_dict):
    """Convenience function to predict risk"""
    predictor = get_predictor()
    return predictor.predict(features_dict)

# Test
if __name__ == "__main__":
    predictor = get_predictor()
    
    test_features = {
        "rain": 15,
        "rain_prob": 70,
        "wind": 8,
        "temperature": 35,
        "aqi": 200,
        "traffic_delay": 1.5,
        "hour": 19
    }
    
    result = predictor.predict(test_features)
    print("\n📊 Prediction Result:")
    print(f"Risk Probability: {result['risk_probability']:.4f}")
    print(f"Risk Level: {result['risk_level']}")
    print(f"Confidence: {result['confidence']:.4f}")
    print(f"\n🔍 Explanation (SHAP):")
    for exp in result['explanation']:
        print(f"  {exp['feature']:20s}: {exp['contribution']:+.4f} ({exp['impact']})")
