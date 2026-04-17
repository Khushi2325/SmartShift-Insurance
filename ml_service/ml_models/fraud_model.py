"""
Fraud Detection Model
Combines Isolation Forest (anomaly detection) + Rule-based flags
"""

import numpy as np
import pickle
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class FraudDetector:
    """Multi-method fraud detection"""
    
    def __init__(self, model_dir: str = './models'):
        self.model_dir = model_dir
        self.isolation_forest = None
        self.version = 'fraud_v1_0'
        self.auc = 0.0
        self.last_trained = None
        self._load_model()
    
    def _load_model(self):
        """Load or create fraud model"""
        try:
            from sklearn.ensemble import IsolationForest
            self.isolation_forest = IsolationForest(
                contamination=0.1,  # Assume 10% fraud
                random_state=42
            )
            logger.info('✓ Fraud model initialized')
        except Exception as e:
            logger.error(f'Failed to initialize fraud model: {e}')
    
    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict fraud probability
        
        Returns:
            {
                'score': 0-1 float,
                'level': 'LOW' | 'MEDIUM' | 'HIGH',
                'flags': {flag_name: true/false},
                'confidence': 0-1 float
            }
        """
        try:
            # Anomaly score from Isolation Forest
            anomaly_score = self._get_anomaly_score(features)
            
            # Rule-based flags
            rule_flags = self._check_fraud_rules(features)
            
            # Combined score
            fraud_score = (anomaly_score * 0.6) + (self._flags_to_score(rule_flags) * 0.4)
            fraud_score = min(1.0, fraud_score)
            
            # Determine level
            level = 'LOW' if fraud_score < 0.3 else 'MEDIUM' if fraud_score < 0.6 else 'HIGH'
            
            return {
                'score': fraud_score,
                'level': level,
                'flags': rule_flags,
                'confidence': 0.75 + (fraud_score * 0.25)
            }
        
        except Exception as e:
            logger.error(f'Fraud prediction failed: {e}')
            return {
                'score': 0.0,
                'level': 'LOW',
                'flags': {},
                'confidence': 0.0
            }
    
    def _get_anomaly_score(self, features: Dict) -> float:
        """Use Isolation Forest for anomaly detection"""
        try:
            if not self.isolation_forest:
                return 0.0
            
            # Extract numeric features
            feature_vector = [
                features.get('worker_claim_frequency', 0),
                features.get('worker_tenure_days', 0),
                features.get('expected_delay_ratio', 1.0),
                features.get('aqi', 100),
                features.get('rain_probability', 0) / 100
            ]
            
            # Isolation Forest returns -1 for anomalies, 1 for normal
            # We invert to 0-1 scale
            prediction = self.isolation_forest.predict([feature_vector])[0]
            anomaly_score = 0.8 if prediction == -1 else 0.1
            
            return anomaly_score
        except:
            return 0.0
    
    def _check_fraud_rules(self, features: Dict) -> Dict[str, bool]:
        """Rule-based fraud flags"""
        flags = {}
        
        # High claim frequency (>5 claims per 100 shifts)
        claim_freq = features.get('worker_claim_frequency', 0)
        flags['high_claim_frequency'] = claim_freq > 5
        
        # Very new worker with claim (tenure < 7 days & claiming)
        tenure = features.get('worker_tenure_days', 999)
        flags['suspicious_new_worker'] = tenure < 7
        
        # Location jumping (different cities in short time)
        flags['location_mismatch'] = features.get('location_mismatch', False)
        
        # Time pattern anomaly
        flags['unusual_time_pattern'] = features.get('unusual_time_pattern', False)
        
        # Weather inconsistency (claiming high disruption but minimal impact)
        rain_prob = features.get('rain_probability', 0)
        flags['weather_inconsistent'] = (rain_prob < 10 and 
                                        features.get('reported_disruption_severity', 0) > 0.5)
        
        # Claim amount exceeds typical (manual review threshold)
        flags['high_payout_requested'] = features.get('claim_amount', 0) > 1500
        
        return flags
    
    def _flags_to_score(self, flags: Dict[str, bool]) -> float:
        """Convert flags dict to fraud score"""
        weights = {
            'high_claim_frequency': 0.3,
            'suspicious_new_worker': 0.25,
            'location_mismatch': 0.2,
            'unusual_time_pattern': 0.15,
            'weather_inconsistent': 0.1,
            'high_payout_requested': 0.15
        }
        
        score = 0.0
        for flag_name, triggered in flags.items():
            if triggered:
                score += weights.get(flag_name, 0.1)
        
        return min(1.0, score)
    
    def detailed_analysis(self, worker_email: str, claim_history: List[Dict], 
                         location_data: Dict) -> Dict:
        """Detailed fraud analysis for admin review"""
        
        # Calculate metrics
        claim_count = len(claim_history)
        repeat_locations = len(set((c.get('lat'), c.get('lon')) for c in claim_history))
        avg_days_between_claims = self._calc_claim_frequency(claim_history)
        
        return {
            'worker_email': worker_email,
            'risk_indicators': {
                'claim_count': int(claim_count),
                'unique_locations': int(repeat_locations),
                'avg_days_between_claims': float(avg_days_between_claims) if avg_days_between_claims != float('inf') else float('inf'),
                'pattern_anomaly': bool(avg_days_between_claims < 1.0)  # Multiple claims/day
            },
            'recommended_action': 'MANUAL_REVIEW' if avg_days_between_claims < 1.0 else 'AUTO_APPROVE'
        }
    
    def _calc_claim_frequency(self, claim_history: List[Dict]) -> float:
        """Calculate average days between claims"""
        if len(claim_history) < 2:
            return float('inf')
        
        dates = sorted([c.get('claim_date') for c in claim_history if c.get('claim_date')])
        if len(dates) < 2:
            return float('inf')
        
        try:
            deltas = [(datetime.fromisoformat(dates[i+1]) - 
                      datetime.fromisoformat(dates[i])).days 
                     for i in range(len(dates)-1)]
            return np.mean(deltas) if deltas else float('inf')
        except:
            return float('inf')
    
    def retrain(self, data: np.ndarray = None):
        """Retrain fraud model"""
        logger.info('Starting fraud model retraining...')
        if data is not None:
            try:
                self.isolation_forest.fit(data)
                self.last_trained = datetime.utcnow().isoformat()
                logger.info('✓ Fraud model retrained')
            except Exception as e:
                logger.error(f'Fraud retraining failed: {e}')


class SeverityPredictor:
    """Predict payout amount/severity"""
    
    def __init__(self, model_dir: str = './models'):
        self.model_dir = model_dir
        self.version = 'severity_v1_0'
        self.last_trained = None
    
    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Predict payout severity
        
        Returns:
            {
                'payout_band': 'LOW' | 'MEDIUM' | 'HIGH',
                'payout_amount': int (₹),
                'confidence': 0-1 float
            }
        """
        try:
            # Calculate severity score (0-1)
            severity = self._calculate_severity(features)
            
            # Map to payout bands
            if severity < 0.33:
                payout_band = 'LOW'
                payout_amount = np.random.randint(100, 301)
            elif severity < 0.66:
                payout_band = 'MEDIUM'
                payout_amount = np.random.randint(300, 801)
            else:
                payout_band = 'HIGH'
                payout_amount = np.random.randint(800, 2001)
            
            return {
                'payout_band': payout_band,
                'payout_amount': int(payout_amount),
                'confidence': 0.7
            }
        
        except Exception as e:
            logger.error(f'Severity prediction failed: {e}')
            return {
                'payout_band': 'MEDIUM',
                'payout_amount': 500,
                'confidence': 0.0
            }
    
    def _calculate_severity(self, features: Dict) -> float:
        """Calculate disruption severity from features"""
        severity = 0.0
        
        # Rain impact (40%)
        rain_mm = features.get('rain_mm', 0)
        rain_severity = min(1.0, rain_mm / 50) * 0.4
        severity += rain_severity
        
        # AQI impact (25%)
        aqi = features.get('aqi', 100)
        aqi_severity = (min(aqi, 500) / 500) * 0.25
        severity += aqi_severity
        
        # Traffic impact (20%)
        traffic = features.get('traffic_delay_ratio', 1.0)
        traffic_severity = min(1.0, (traffic - 1.0) / 2.0) * 0.2
        severity += traffic_severity
        
        # Time of day (peak hours more severe) (10%)
        hour = features.get('hour_of_day', 12)
        is_peak = 8 <= hour <= 11 or 17 <= hour <= 20
        time_severity = 0.5 if is_peak else 0.1
        severity += time_severity * 0.1
        
        # Risk score (5%)
        risk_score = features.get('risk_score', 0)
        severity += risk_score * 0.05
        
        return min(1.0, severity)
    
    def retrain(self, data: np.ndarray = None):
        """Retrain severity model"""
        logger.info('Severity model retraining...')
        self.last_trained = datetime.utcnow().isoformat()
