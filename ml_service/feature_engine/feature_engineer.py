"""
Feature Engineering Pipeline
Converts raw weather/traffic/user data into ML-ready features
"""

import numpy as np
import pandas as pd
import logging
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class FeatureEngineer:
    """
    Feature engineering for ML models
    Handles: normalization, missing data, feature creation
    """
    
    def __init__(self):
        self.feature_version = 'v1_0'
        self.feature_names = None
        self.scaler_params = {}
    
    def extract_features(self, location: Dict, weather: Dict, traffic: Dict,
                        worker_history: Dict, time_of_day: int, 
                        day_of_week: int) -> Dict[str, float]:
        """
        Extract and engineer features from raw data
        
        Args:
            location: {lat, lon, city}
            weather: {temp, rain_mm, rain_prob, wind_speed, aqi, pm2_5}
            traffic: {delay_ratio, congestion_index}
            worker_history: {tenure_days, shift_count, claim_freq, fraud_score}
            time_of_day: 0-23
            day_of_week: 0-6
        
        Returns:
            Dictionary of engineered features
        """
        
        features = {}
        
        # ===== WEATHER FEATURES =====
        features.update(self._engineer_weather_features(weather))
        
        # ===== TRAFFIC FEATURES =====
        features.update(self._engineer_traffic_features(traffic))
        
        # ===== TEMPORAL FEATURES =====
        features.update(self._engineer_temporal_features(time_of_day, day_of_week))
        
        # ===== WORKER FEATURES =====
        features.update(self._engineer_worker_features(worker_history))
        
        # ===== LOCATION FEATURES =====
        features.update(self._engineer_location_features(location))
        
        # ===== INTERACTION FEATURES =====
        features.update(self._engineer_interactions(features))
        
        # ===== METADATA =====
        features['feature_version'] = self.feature_version
        features['engineered_at'] = datetime.utcnow().isoformat()
        
        logger.info(f'✓ Engineered {len(features)} features')
        
        return features
    
    def _engineer_weather_features(self, weather: Dict) -> Dict[str, float]:
        """Create weather-derived features"""
        
        feats = {}
        
        # Direct features
        feats['temperature'] = float(weather.get('temperature', 25) or 25)
        feats['rain_mm'] = float(weather.get('rain_mm', 0) or 0)
        feats['rain_probability'] = float(weather.get('rain_probability', 0) or 0)
        feats['wind_speed'] = float(weather.get('wind_speed', 0) or 0)
        feats['aqi'] = float(weather.get('aqi', 100) or 100)
        feats['pm2_5'] = float(weather.get('pm2_5', 30) or 30)
        
        # Derived features
        # Temperature severity: risk increases at both extremes
        temp = feats['temperature']
        feats['temp_severity'] = 1.0 if temp < 0 or temp > 45 else (
            0.5 if temp < 5 or temp > 38 else 0.0
        )
        
        # Rain intensity (mm is direct measure)
        feats['rain_intensity'] = min(1.0, feats['rain_mm'] / 50)  # >50mm is max
        
        # Combined rainfall risk
        feats['rainfall_risk'] = (feats['rain_probability'] / 100 * 0.6 + 
                                 feats['rain_intensity'] * 0.4)
        
        # Air quality impact
        feats['air_quality_severity'] = min(1.0, feats['aqi'] / 500)
        
        # Respiratory risk (pm2.5 is main driver)
        feats['respiratory_risk'] = min(1.0, feats['pm2_5'] / 250)
        
        # Overall weather severity index
        feats['weather_severity_index'] = (
            feats['rain_intensity'] * 0.3 +
            feats['air_quality_severity'] * 0.25 +
            feats['temp_severity'] * 0.2 +
            min(1.0, feats['wind_speed'] / 50) * 0.15 +
            (feats['rain_probability'] / 100) * 0.1
        )
        
        # Comfort index (inverse - higher is worse)
        feats['discomfort_index'] = (
            abs(feats['temperature'] - 25) / 25 * 0.4 +  # Optimal ~25°C
            feats['humidity'] / 100 * 0.3 if 'humidity' in weather else 0.0 +
            feats['rainfall_risk'] * 0.3
        )
        
        return feats
    
    def _engineer_traffic_features(self, traffic: Dict) -> Dict[str, float]:
        """Create traffic-derived features"""
        
        feats = {}
        
        # Direct features
        feats['traffic_delay_ratio'] = float(traffic.get('delay_ratio', 1.0) or 1.0)
        feats['congestion_index'] = float(traffic.get('congestion_index', 0) or 0)
        
        # Derived features
        # Delay severity (1.0 = free flow, 3.0 = severe)
        delay = feats['traffic_delay_ratio']
        feats['delay_severity'] = max(0.0, min(1.0, (delay - 1.0) / 2.0))
        
        # Traffic impact on disruption (scaling)
        feats['traffic_disruption_factor'] = feats['delay_severity'] * 0.5 + \
                                             feats['congestion_index'] * 0.5
        
        return feats
    
    def _engineer_temporal_features(self, hour: int, dow: int) -> Dict[str, float]:
        """Create time-based features"""
        
        feats = {}
        
        feats['hour_of_day'] = float(hour)
        feats['day_of_week'] = float(dow)
        
        # Peak hours (morning: 6-11, evening: 16-20)
        is_morning_peak = 6 <= hour <= 11
        is_evening_peak = 16 <= hour <= 20
        feats['is_peak_hour'] = 1.0 if (is_morning_peak or is_evening_peak) else 0.0
        
        # Night hours (higher risk 22-6)
        is_night = hour >= 22 or hour < 6
        feats['is_night'] = 1.0 if is_night else 0.0
        
        # Weekend
        is_weekend = dow >= 5  # Saturday=5, Sunday=6
        feats['is_weekend'] = 1.0 if is_weekend else 0.0
        
        # Business hours (9-18, Mon-Fri)
        feats['is_business_hours'] = 1.0 if (9 <= hour <= 18 and dow < 5) else 0.0
        
        # Hour of day sinuso​idal encoding (captures 24h cyclicity)
        feats['hour_sin'] = np.sin(2 * np.pi * hour / 24)
        feats['hour_cos'] = np.cos(2 * np.pi * hour / 24)
        
        # Day of week sinusoidal encoding
        feats['dow_sin'] = np.sin(2 * np.pi * dow / 7)
        feats['dow_cos'] = np.cos(2 * np.pi * dow / 7)
        
        return feats
    
    def _engineer_worker_features(self, worker_history: Dict) -> Dict[str, float]:
        """Create worker-derived features"""
        
        feats = {}
        
        # Direct features
        feats['worker_tenure_days'] = float(worker_history.get('tenure_days', 0) or 0)
        feats['worker_shift_count'] = float(worker_history.get('shift_count', 0) or 0)
        feats['worker_claim_frequency'] = float(worker_history.get('claim_frequency', 0) or 0)
        feats['worker_fraud_score'] = float(worker_history.get('fraud_score', 0) or 0)
        
        # Derived features
        # Experience level (0 = new, 1 = veteran)
        feats['worker_experience_level'] = min(1.0, feats['worker_tenure_days'] / 365)
        
        # Worker reliability (inverse of fraud score and claim frequency)
        feats['worker_reliability_score'] = 1.0 - (
            feats['worker_fraud_score'] * 0.7 +
            min(1.0, feats['worker_claim_frequency'] / 10) * 0.3
        )
        
        # New worker flag (< 30 days)
        feats['is_new_worker'] = 1.0 if feats['worker_tenure_days'] < 30 else 0.0
        
        # High-frequency claimer (> 5 claims/100 shifts)
        feats['is_frequent_claimer'] = 1.0 if feats['worker_claim_frequency'] > 5 else 0.0
        
        return feats
    
    def _engineer_location_features(self, location: Dict) -> Dict[str, float]:
        """Create location-derived features"""
        
        feats = {}
        
        city = location.get('city', 'Unknown')
        feats['city'] = city
        
        # City encoding (could use embeddings, for now use one-hot style)
        city_risk_profile = {
            'Mumbai': 0.7,      # High traffic, congestion
            'Delhi': 0.8,       # High pollution
            'Bangalore': 0.5,   # Moderate
            'Chennai': 0.6,     # High heat + humidity
            'Vadodara': 0.4     # Lower risk
        }
        feats['city_baseline_risk'] = city_risk_profile.get(city, 0.5)
        
        # Zone type estimation
        lat = location.get('lat', 0)
        lon = location.get('lon', 0)
        feats['is_downtown'] = 1.0 if (lat and lon) else 0.0  # Placeholder
        
        return feats
    
    def _engineer_interactions(self, features: Dict) -> Dict[str, float]:
        """Create interaction features between existing features"""
        
        new_feats = {}
        
        # Rain + Peak hours = worse
        rain_prob = features.get('rain_probability', 0) / 100
        is_peak = features.get('is_peak_hour', 0)
        new_feats['rain_during_peak'] = rain_prob * is_peak
        
        # High AQI + Night = worse (less visibility)
        aqi_sev = features.get('air_quality_severity', 0)
        is_night = features.get('is_night', 0)
        new_feats['aqi_at_night'] = aqi_sev * is_night
        
        # New worker + bad weather = higher risk
        is_new = features.get('is_new_worker', 0)
        weather_sev = features.get('weather_severity_index', 0)
        new_feats['new_worker_bad_weather'] = is_new * weather_sev
        
        # Traffic + rain = compound risk
        traffic = features.get('traffic_disruption_factor', 0)
        rain = features.get('rainfall_risk', 0)
        new_feats['rain_and_traffic'] = traffic * rain
        
        return new_feats
    
    def create_training_dataset(self, raw_data: List[Dict]) -> pd.DataFrame:
        """
        Convert list of raw weather/traffic/worker data into training dataset
        
        Args:
            raw_data: List of dicts with location, weather, traffic, worker_history, time info
        
        Returns:
            pandas DataFrame ready for model training
        """
        
        rows = []
        for record in raw_data:
            features = self.extract_features(
                location=record.get('location', {}),
                weather=record.get('weather', {}),
                traffic=record.get('traffic', {}),
                worker_history=record.get('worker_history', {}),
                time_of_day=record.get('time_of_day', 12),
                day_of_week=record.get('day_of_week', 0)
            )
            
            # Add target variable (if available)
            features['disruption_occurred'] = record.get('disruption_occurred', False)
            features['claim_amount'] = record.get('claim_amount', 0)
            
            rows.append(features)
        
        return pd.DataFrame(rows)
