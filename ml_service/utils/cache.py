"""
Utility modules for ML service
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Any, Optional

# ============================================================================
# CACHE LAYER
# ============================================================================

class RedisCache:
    """Redis-based caching for ML predictions"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url
        self.cache = {}  # In-memory fallback
        self.use_redis = False
        
        try:
            if redis_url:
                import redis
                self.redis_client = redis.from_url(redis_url)
                self.redis_client.ping()
                self.use_redis = True
                logging.info('✓ Redis cache initialized')
            else:
                logging.info('Using in-memory cache fallback')
        except Exception as e:
            logging.warning(f'Redis unavailable: {e}, using in-memory cache')
    
    def get(self, key: str) -> Optional[dict]:
        """Get value from cache"""
        try:
            if self.use_redis:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            else:
                # In-memory fallback
                if key in self.cache:
                    data, expiry = self.cache[key]
                    if datetime.now() < expiry:
                        return data
                    else:
                        del self.cache[key]
            return None
        except Exception as e:
            logging.error(f'Cache get failed: {e}')
            return None
    
    def set(self, key: str, value: dict, ttl: int = 300):
        """Set value in cache with TTL"""
        try:
            if self.use_redis:
                self.redis_client.setex(
                    key,
                    ttl,
                    json.dumps(value)
                )
            else:
                # In-memory fallback
                expiry = datetime.now() + timedelta(seconds=ttl)
                self.cache[key] = (value, expiry)
        except Exception as e:
            logging.error(f'Cache set failed: {e}')
    
    def clear(self, pattern: str = None):
        """Clear cache"""
        try:
            if self.use_redis and pattern:
                keys = self.redis_client.keys(pattern)
                for key in keys:
                    self.redis_client.delete(key)
            else:
                self.cache.clear()
        except Exception as e:
            logging.error(f'Cache clear failed: {e}')


# ============================================================================
# LOGGER
# ============================================================================

def setup_logger(name: str, log_file: str = None) -> logging.Logger:
    """Setup logging configuration"""
    
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    ch.setFormatter(formatter)
    
    logger.addHandler(ch)
    
    # File handler (optional)
    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setLevel(logging.INFO)
        fh.setFormatter(formatter)
        logger.addHandler(fh)
    
    return logger


# ============================================================================
# METRICS
# ============================================================================

class MetricsCollector:
    """Collect model performance metrics"""
    
    def __init__(self):
        self.predictions = []
        self.outcomes = []
    
    def record_prediction(self, prediction: dict, outcome: bool = None):
        """Record prediction and optionally actual outcome"""
        record = {
            'timestamp': datetime.utcnow().isoformat(),
            'prediction': prediction,
            'outcome': outcome
        }
        self.predictions.append(record)
    
    def calculate_auc(self) -> float:
        """Calculate AUC from predictions with outcomes"""
        try:
            from sklearn.metrics import roc_auc_score
            
            y_true = [p['outcome'] for p in self.predictions if p['outcome'] is not None]
            y_pred = [p['prediction']['risk_score'] for p in self.predictions if p['outcome'] is not None]
            
            if len(y_true) < 2:
                return 0.0
            
            return roc_auc_score(y_true, y_pred)
        except Exception as e:
            logging.error(f'AUC calculation failed: {e}')
            return 0.0
    
    def calculate_precision(self, threshold: float = 0.5) -> float:
        """Calculate precision"""
        try:
            from sklearn.metrics import precision_score
            
            y_true = [p['outcome'] for p in self.predictions if p['outcome'] is not None]
            y_pred = [1 if p['prediction']['risk_score'] > threshold else 0 
                     for p in self.predictions if p['outcome'] is not None]
            
            if len(y_true) == 0:
                return 0.0
            
            return precision_score(y_true, y_pred, zero_division=0)
        except Exception as e:
            logging.error(f'Precision calculation failed: {e}')
            return 0.0
    
    def get_summary(self) -> dict:
        """Get metrics summary"""
        return {
            'total_predictions': len(self.predictions),
            'labeled_outcomes': len([p for p in self.predictions if p['outcome'] is not None]),
            'auc': self.calculate_auc(),
            'precision': self.calculate_precision(),
            'generated_at': datetime.utcnow().isoformat()
        }


# ============================================================================
# VALIDATORS
# ============================================================================

class InputValidator:
    """Validate ML inputs"""
    
    @staticmethod
    def validate_location(location: dict) -> tuple[bool, str]:
        """Validate location object"""
        required = ['lat', 'lon', 'city']
        for field in required:
            if field not in location:
                return False, f'Missing required field: {field}'
        
        lat, lon = location['lat'], location['lon']
        if not (-90 <= lat <= 90):
            return False, f'Invalid latitude: {lat}'
        if not (-180 <= lon <= 180):
            return False, f'Invalid longitude: {lon}'
        
        return True, 'valid'
    
    @staticmethod
    def validate_weather(weather: dict) -> tuple[bool, str]:
        """Validate weather object"""
        
        # Check temperature ranges
        if 'temperature' in weather:
            temp = float(weather['temperature'])
            if temp < -50 or temp > 60:
                return False, f'Temperature out of range: {temp}'
        
        # Check probability (0-100)
        if 'rain_probability' in weather:
            rain_prob = float(weather['rain_probability'])
            if not (0 <= rain_prob <= 100):
                return False, f'Rain probability must be 0-100: {rain_prob}'
        
        # Check AQI (>= 0)
        if 'aqi' in weather:
            aqi = float(weather['aqi'])
            if aqi < 0:
                return False, f'AQI must be >= 0: {aqi}'
        
        return True, 'valid'
    
    @staticmethod
    def validate_worker_history(worker_history: dict) -> tuple[bool, str]:
        """Validate worker history"""
        
        tenure = worker_history.get('tenure_days', 0)
        if tenure < 0:
            return False, f'Tenure cannot be negative: {tenure}'
        
        claim_freq = worker_history.get('claim_frequency', 0)
        if claim_freq < 0:
            return False, f'Claim frequency cannot be negative: {claim_freq}'
        
        fraud_score = worker_history.get('fraud_score', 0)
        if not (0 <= fraud_score <= 1):
            return False, f'Fraud score must be 0-1: {fraud_score}'
        
        return True, 'valid'


# ============================================================================
# DATA GENERATORS
# ============================================================================

class SyntheticDataGenerator:
    """Generate synthetic training data"""
    
    @staticmethod
    def generate_weather_record() -> dict:
        """Generate random weather record"""
        import random
        
        return {
            'temperature': random.uniform(5, 40),
            'rain_mm': random.choice([0, 0, 0, 0, 5, 10, 25, 50]),
            'rain_probability': random.randint(0, 100),
            'wind_speed': random.uniform(0, 30),
            'aqi': random.randint(20, 350),
            'pm2_5': random.uniform(10, 200)
        }
    
    @staticmethod
    def generate_traffic_record() -> dict:
        """Generate random traffic record"""
        import random
        
        return {
            'delay_ratio': random.uniform(1.0, 3.0),
            'congestion_index': random.uniform(0, 1),
            'distance_km': random.uniform(5, 50)
        }
    
    @staticmethod
    def generate_worker_record() -> dict:
        """Generate random worker history"""
        import random
        
        return {
            'tenure_days': random.randint(1, 1000),
            'shift_count': random.randint(1, 500),
            'claim_frequency': random.uniform(0, 10),
            'fraud_score': random.uniform(0, 0.3)
        }
    
    @staticmethod
    def generate_dataset(n_samples: int = 1000) -> list:
        """Generate full synthetic dataset"""
        import random
        
        dataset = []
        for _ in range(n_samples):
            sample = {
                'location': {
                    'lat': random.uniform(15, 35),
                    'lon': random.uniform(68, 88),
                    'city': random.choice(['Mumbai', 'Vadodara', 'Delhi', 'Bangalore', 'Chennai'])
                },
                'weather': SyntheticDataGenerator.generate_weather_record(),
                'traffic': SyntheticDataGenerator.generate_traffic_record(),
                'worker_history': SyntheticDataGenerator.generate_worker_record(),
                'time_of_day': random.randint(0, 23),
                'day_of_week': random.randint(0, 6),
                'disruption_occurred': random.choice([True, False])
            }
            dataset.append(sample)
        
        return dataset
