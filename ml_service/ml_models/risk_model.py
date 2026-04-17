"""
Risk Prediction Model
Predicts probability of disruption in next 1-2 hours
Algorithm: XGBoost (gradient boosting) trained on real API data
"""

import os
import joblib
import numpy as np
import logging
from typing import Dict, List
import xgboost as xgb

logger = logging.getLogger(__name__)

class RiskPredictor:
    """XGBoost-based risk prediction with SHAP explainability"""

    FEATURE_NAMES = ["rain", "wind", "temperature", "aqi", "traffic", "hour"]
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "xgboost_risk_model.pkl")

    def __init__(self, model_dir: str = './models'):
        self.model_dir = model_dir
        self.model = None
        self.explainer = None
        self.load_model()
    
    def load_model(self):
        """Load pre-trained XGBoost model"""
        try:
            if os.path.exists(self.MODEL_PATH):
                self.model = joblib.load(self.MODEL_PATH)
                logger.info("✅ XGBoost model loaded successfully")
                self._init_explainer()
            else:
                logger.warning(f"⚠️ Model not found at {self.MODEL_PATH}")
                logger.warning("   Run: python ml_service/train.py")
                self.model = None
        except Exception as e:
            logger.error(f"❌ Error loading model: {e}")
            self.model = None

    def _init_explainer(self):
        """Initialize SHAP explainer"""
        try:
            import shap
            self.explainer = shap.TreeExplainer(self.model)
            logger.info("✅ SHAP explainer initialized")
        except Exception as e:
            logger.error(f"⚠️ Could not initialize SHAP: {e}")
            self.explainer = None

    def predict(self, features: Dict[str, float]) -> Dict:
        """
        Predict risk score (0-1)
        
        Args:
            features: Dict with keys ["rain", "wind", "temperature", "aqi", "traffic", "hour"]
        
        Returns:
            {
                'score': 0-1 float,
                'level': 'LOW' | 'MEDIUM' | 'HIGH',
                'explanation': [...]
            }
        """
        if self.model is None:
            logger.warning("Model not loaded, using fallback")
            risk_score = self._fallback_risk(features)
        else:
            try:
                # Extract features in correct order
                X = np.array([[
                    features.get("rain", 0),
                    features.get("wind", 0),
                    features.get("temperature", 0),
                    features.get("aqi", 0),
                    features.get("traffic", 0),
                    features.get("hour", 0),
                ]])

                # Get probability for high-risk class (1)
                prob = self.model.predict_proba(X)[0][1]
                risk_score = float(prob)

            except Exception as e:
                logger.error(f"Prediction error: {e}")
                risk_score = self._fallback_risk(features)

        # Clamp to 0-1
        risk_score = max(0.0, min(1.0, risk_score))

        # Determine level
        level = 'LOW' if risk_score < 0.33 else 'MEDIUM' if risk_score < 0.66 else 'HIGH'

        # Get explanation
        explanation = self.explain(features)

        return {
            'score': risk_score,
            'level': level,
            'probabilities': {
                'low': max(0, 1 - risk_score),
                'medium': max(0, 1 - abs(risk_score - 0.5) * 2),
                'high': risk_score
            },
            'confidence': min(0.95, 0.5 + risk_score * 0.5),
            'explanation': explanation
        }

    def explain(self, features: Dict[str, float]) -> List[Dict]:
        """
        Explain prediction using SHAP values
        
        Returns:
            List of {"feature": name, "contribution": float}
        """
        if self.model is None or self.explainer is None:
            logger.warning("Model/explainer not available, using fallback")
            return self._fallback_explanation(features)

        try:
            # Prepare feature array
            X = np.array([[
                features.get("rain", 0),
                features.get("wind", 0),
                features.get("temperature", 0),
                features.get("aqi", 0),
                features.get("traffic", 0),
                features.get("hour", 0),
            ]])

            # Get SHAP values
            shap_values = self.explainer.shap_values(X)
            
            # Handle both single output and multi-class output
            if isinstance(shap_values, list):
                shap_vals = shap_values[1][0]  # High-risk class
            else:
                shap_vals = shap_values[0]

            # Create explanation
            explanation = []
            for i, feature_name in enumerate(self.FEATURE_NAMES):
                contribution = float(shap_vals[i])
                explanation.append({
                    "feature": feature_name,
                    "contribution": contribution,
                    "impact": "increased" if contribution > 0 else "decreased"
                })

            # Sort by absolute contribution
            explanation.sort(key=lambda x: abs(x["contribution"]), reverse=True)
            return explanation

        except Exception as e:
            logger.error(f"Explanation error: {e}")
            return self._fallback_explanation(features)

    @staticmethod
    def _fallback_risk(features: Dict[str, float]) -> float:
        """Fallback rule-based risk calculation"""
        risk = (
            0.35 * features.get("rain", 0) +
            0.25 * features.get("aqi", 0) +
            0.15 * features.get("wind", 0) +
            0.15 * features.get("traffic", 0) +
            0.10 * features.get("hour", 0)
        )
        return float(np.clip(risk, 0, 1))

    @staticmethod
    def _fallback_explanation(features: Dict[str, float]) -> List[Dict]:
        """Fallback explanation using rule weights"""
        contributions = {
            "rain": 0.35 * features.get("rain", 0),
            "aqi": 0.25 * features.get("aqi", 0),
            "wind": 0.15 * features.get("wind", 0),
            "traffic": 0.15 * features.get("traffic", 0),
            "hour": 0.10 * features.get("hour", 0),
            "temperature": 0.0
        }

        explanation = [
            {
                "feature": feature,
                "contribution": contrib,
                "impact": "increased" if contrib > 0 else "decreased"
            }
            for feature, contrib in contributions.items()
        ]

        return sorted(explanation, key=lambda x: abs(x["contribution"]), reverse=True)
