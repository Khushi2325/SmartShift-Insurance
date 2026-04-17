"""
Explainability Layer - SHAP-based feature attribution
Makes ML predictions interpretable to workers and admins
"""

import numpy as np
import logging
from typing import Dict, List, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class ExplainerSHAP:
    """
    SHAP-based explainability
    Explains which features most contributed to risk prediction
    """
    
    def __init__(self, model):
        self.model = model
        self.explainer = None
        self._init_explainer()
    
    def _init_explainer(self):
        """Initialize SHAP explainer"""
        try:
            import shap
            # For TreeExplainer with tree models
            self.explainer = shap.TreeExplainer(self.model)
            logger.info('✓ SHAP TreeExplainer initialized')
        except ImportError:
            logger.warning('SHAP not installed, using simplified explainability')
            self.explainer = None
        except Exception as e:
            logger.warning(f'SHAP init failed: {e}, using fallback')
            self.explainer = None
    
    def explain(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Get SHAP explanations for predictions
        
        Args:
            features: normalized feature vector
        
        Returns:
            {
                'top_factors': [{'name': 'rain_probability', 'contribution': 0.35, 'direction': 'increase'}],
                'contributions': {'feature_name': 0.25, ...},
                'base_value': 0.5
            }
        """
        
        try:
            if self.explainer:
                # Get SHAP values
                shap_values = self.explainer.shap_values(features.reshape(1, -1))
                
                # Extract (handle both binary and multiclass)
                if isinstance(shap_values, list):
                    shap_vals = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
                else:
                    shap_vals = shap_values[0]
                
                # Feature names
                feature_names = self._get_feature_names()
                
                # Get contributions
                contributions = {
                    name: float(val)
                    for name, val in zip(feature_names, shap_vals)
                }
                
            else:
                # Fallback: permutation importance
                contributions = self._get_fallback_importance(features)
            
            # Get top factors
            top_factors = self._get_top_factors(contributions)
            
            return {
                'top_factors': top_factors,
                'contributions': contributions,
                'base_value': 0.5,  # Average prediction
                'method': 'SHAP' if self.explainer else 'permutation_importance'
            }
        
        except Exception as e:
            logger.error(f'SHAP explain failed: {e}')
            return {
                'top_factors': [],
                'contributions': {},
                'base_value': 0.5,
                'error': str(e)
            }
    
    def _get_feature_names(self) -> List[str]:
        """Get standard feature names"""
        return [
            'rain_probability', 'rain_mm', 'wind_speed', 'temperature',
            'aqi', 'pm2_5', 'traffic_delay_ratio', 'congestion_index',
            'hour_of_day', 'day_of_week', 'is_peak_hour', 'is_weekend',
            'worker_tenure_days', 'worker_claim_frequency', 'city_baseline_risk'
        ]
    
    def _get_top_factors(self, contributions: Dict[str, float], top_k: int = 3) -> List[Dict]:
        """Extract top K contributing factors"""
        
        # Sort by absolute contribution
        sorted_contrib = sorted(
            contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )
        
        top_factors = []
        for name, contrib in sorted_contrib[:top_k]:
            # Determine direction
            direction = 'increase' if contrib > 0 else 'decrease'
            
            # Get human-readable explanation
            explanation = self._get_factor_explanation(name, contrib)
            
            top_factors.append({
                'name': name,
                'contribution': float(contrib),
                'direction': direction,
                'explanation': explanation,
                'importance_pct': abs(float(contrib)) * 100
            })
        
        return top_factors
    
    def _get_factor_explanation(self, factor_name: str, contribution: float) -> str:
        """Get human-readable explanation for a factor"""
        
        explanations = {
            'rain_probability': {
                'increase': 'High rainfall probability increases disruption risk',
                'decrease': 'Low rainfall probability reduces risk'
            },
            'rain_mm': {
                'increase': 'Heavy rainfall increases disruption',
                'decrease': 'Light/no rain is safer'
            },
            'temperature': {
                'increase': 'Extreme temperature increases physical stress',
                'decrease': 'Moderate temperature is comfortable'
            },
            'aqi': {
                'increase': 'High air pollution increases health risks',
                'decrease': 'Good air quality is safe'
            },
            'traffic_delay_ratio': {
                'increase': 'Heavy traffic causes delivery delays',
                'decrease': 'Light traffic is faster'
            },
            'is_peak_hour': {
                'increase': 'Peak hours have more congestion',
                'decrease': 'Off-peak hours have lighter traffic'
            },
            'worker_claim_frequency': {
                'increase': 'High claim history increases fraud flags',
                'decrease': 'Low claim history reduces suspicion'
            },
            'is_new_worker': {
                'increase': 'New workers are less experienced',
                'decrease': 'Experienced workers have better track records'
            }
        }
        
        if factor_name in explanations:
            dir_key = 'increase' if contribution > 0 else 'decrease'
            return explanations[factor_name].get(dir_key, 'Factor affects risk score')
        
        return f'{factor_name} affects risk assessment'
    
    def _get_fallback_importance(self, features: np.ndarray) -> Dict[str, float]:
        """Fallback importance when SHAP unavailable"""
        
        feature_names = self._get_feature_names()
        
        # Simple heuristic: scale features by their typical impact
        importance_weights = {
            'rain_probability': 0.15,
            'rain_mm': 0.15,
            'wind_speed': 0.05,
            'temperature': 0.1,
            'aqi': 0.12,
            'pm2_5': 0.08,
            'traffic_delay_ratio': 0.1,
            'congestion_index': 0.08,
            'hour_of_day': 0.05,
            'day_of_week': 0.02,
            'is_peak_hour': 0.08,
            'is_weekend': 0.02,
            'worker_tenure_days': 0.02,
            'worker_claim_frequency': 0.03,
            'city_baseline_risk': 0.04
        }
        
        contributions = {}
        for name, weight in importance_weights.items():
            idx = feature_names.index(name) if name in feature_names else 0
            if idx < len(features):
                contributions[name] = float(features[idx] * weight)
        
        return contributions
    
    def to_natural_language(self, shap_explanation: Dict, risk_output: Dict) -> str:
        """
        Convert SHAP explanation to natural language sentence
        
        Returns:
            "High risk (0.78) due to heavy rain (40%), traffic congestion (30%), and poor air quality (20%)"
        """
        
        risk_score = risk_output.get('score', 0.5)
        risk_level = risk_output.get('level', 'MEDIUM')
        
        top_factors = shap_explanation.get('top_factors', [])
        
        if not top_factors:
            return f"Risk is {risk_level} ({risk_score:.0%}) due to current conditions"
        
        # Build factor string
        factor_strings = []
        for i, factor in enumerate(top_factors[:3]):  # Top 3 factors
            name = factor.get('name', '').replace('_', ' ').title()
            importance = factor.get('importance_pct', 0)
            factor_strings.append(f"{name} (+{importance:.0f}%)")
        
        factors_text = ', '.join(factor_strings)
        
        return f"Risk is {risk_level} ({risk_score:.0%}) due to {factors_text}"
    
    def generate_worker_alert(self, shap_explanation: Dict, risk_score: float) -> Dict:
        """Generate actionable alert for worker with recommendations"""
        
        top_factors = shap_explanation.get('top_factors', [])
        
        # Determine action based on risk
        if risk_score > 0.66:
            alert_type = 'HIGH_RISK_WARNING'
            action = 'Consider delaying or canceling this shift'
        elif risk_score > 0.33:
            alert_type = 'MODERATE_WARNING'
            action = 'Be alert and take extra precautions'
        else:
            alert_type = 'LOW_RISK_INFO'
            action = 'Conditions are favorable for work'
        
        # Build recommendation text
        recommendations = []
        for factor in top_factors:
            if 'rain' in factor['name'].lower():
                recommendations.append('Check rain report and carry waterproof gear')
            elif 'traffic' in factor['name'].lower():
                recommendations.append('Use navigation app for optimal routes')
            elif 'aqi' in factor['name'].lower():
                recommendations.append('Wear N95 mask for air quality protection')
            elif 'temperature' in factor['name'].lower():
                recommendations.append('Stay hydrated and take breaks frequently')
        
        return {
            'alert_type': alert_type,
            'risk_score': risk_score,
            'primary_action': action,
            'recommendations': recommendations,
            'generated_at': datetime.utcnow().isoformat()
        }


class ExplainerHTML:
    """Generate HTML visualizations for dashboard"""
    
    @staticmethod
    def render_risk_factors(top_factors: List[Dict]) -> str:
        """Render top factors as HTML card"""
        html = '<div class="risk-factors">'
        
        for factor in top_factors:
            html += f'''
            <div class="factor-item">
                <span class="factor-name">{factor["name"]}</span>
                <span class="factor-importance">{factor["importance_pct"]:.0f}%</span>
                <div class="factor-bar" style="width: {factor["importance_pct"]:.0f}%"></div>
                <p class="factor-explanation">{factor.get("explanation", "")}</p>
            </div>
            '''
        
        html += '</div>'
        return html
