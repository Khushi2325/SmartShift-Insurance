# ml_service/ml_models/data_pipeline.py
# Real-time data collection from external APIs

import requests
import os
from datetime import datetime
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

OPENWEATHER_KEY = os.getenv("OPENWEATHER_KEY")
WAQI_KEY = os.getenv("WAQI_KEY")

class DataCollector:
    """Collect real environmental data from APIs"""

    @staticmethod
    def get_weather_data(city: str, lat: float = None, lon: float = None) -> Dict[str, Any]:
        """Fetch weather data from Open-Meteo (free, no key required)"""
        try:
            if lat is None or lon is None:
                # Geocode city to coordinates
                geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
                geo_res = requests.get(geo_url, timeout=5)
                if geo_res.status_code != 200:
                    return DataCollector._default_weather()
                
                geo_data = geo_res.json()
                if not geo_data.get("results"):
                    return DataCollector._default_weather()
                
                result = geo_data["results"][0]
                lat, lon = result["latitude"], result["longitude"]

            # Fetch weather from Open-Meteo
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,rain,wind_speed_10m"
            res = requests.get(url, timeout=5)
            
            if res.status_code != 200:
                return DataCollector._default_weather()

            data = res.json()["current"]

            return {
                "temperature": data.get("temperature_2m", 25),
                "humidity": data.get("relative_humidity_2m", 50),
                "rain": data.get("rain", 0),
                "wind_speed": data.get("wind_speed_10m", 3),
                "weather_code": data.get("weather_code", 0),
                "timestamp": datetime.now().isoformat(),
                "source": "open-meteo"
            }
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            return DataCollector._default_weather()

    @staticmethod
    def get_aqi_data(city: str, lat: float = None, lon: float = None) -> Dict[str, Any]:
        """Fetch AQI data from WAQI or OpenAQ"""
        try:
            if lat is None or lon is None:
                # Geocode city
                geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
                geo_res = requests.get(geo_url, timeout=5)
                if geo_res.status_code != 200:
                    return DataCollector._default_aqi()
                
                geo_data = geo_res.json()
                if not geo_data.get("results"):
                    return DataCollector._default_aqi()
                
                result = geo_data["results"][0]
                lat, lon = result["latitude"], result["longitude"]

            # Try WAQI first (if key available)
            if WAQI_KEY:
                try:
                    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_KEY}"
                    res = requests.get(url, timeout=5)
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("status") == "ok":
                            aqi_data = data["data"]
                            return {
                                "aqi": aqi_data.get("aqi", 75),
                                "pm25": aqi_data.get("iaqi", {}).get("pm25", {}).get("v", 25),
                                "pm10": aqi_data.get("iaqi", {}).get("pm10", {}).get("v", 40),
                                "timestamp": datetime.now().isoformat(),
                                "source": "waqi"
                            }
                except:
                    pass

            # Fallback to OpenAQ
            try:
                url = f"https://api.openaq.org/v2/latest?coordinates={lat},{lon}&limit=1"
                res = requests.get(url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("results"):
                        result = data["results"][0]
                        return {
                            "aqi": result.get("measurements", [{}])[0].get("value", 75),
                            "pm25": result.get("measurements", [{}])[0].get("value", 25),
                            "pm10": 40,
                            "timestamp": datetime.now().isoformat(),
                            "source": "openaq"
                        }
            except:
                pass

            return DataCollector._default_aqi()
        except Exception as e:
            logger.error(f"AQI fetch error: {e}")
            return DataCollector._default_aqi()

    @staticmethod
    def get_traffic_data(city: str) -> Dict[str, Any]:
        """Simulate traffic data (Mapbox requires API key)"""
        # Using simple heuristic for now
        import random
        return {
            "delay_ratio": round(random.uniform(0.8, 1.5), 2),
            "congestion_level": random.choice(["light", "moderate", "heavy"]),
            "timestamp": datetime.now().isoformat(),
            "source": "simulated"
        }

    @staticmethod
    def _default_weather() -> Dict[str, Any]:
        return {
            "temperature": 28,
            "humidity": 60,
            "rain": 0,
            "wind_speed": 5,
            "weather_code": 0,
            "timestamp": datetime.now().isoformat(),
            "source": "default"
        }

    @staticmethod
    def _default_aqi() -> Dict[str, Any]:
        return {
            "aqi": 75,
            "pm25": 25,
            "pm10": 40,
            "timestamp": datetime.now().isoformat(),
            "source": "default"
        }

    @staticmethod
    def collect_features(city: str, lat: float = None, lon: float = None) -> Dict[str, float]:
        """Collect and normalize all features for ML model"""
        weather = DataCollector.get_weather_data(city, lat, lon)
        aqi = DataCollector.get_aqi_data(city, lat, lon)
        traffic = DataCollector.get_traffic_data(city)

        # Normalize features to 0-1 range
        features = {
            "rain": min(weather["rain"] / 50, 1.0),  # Normalize: 50mm = max
            "wind": min(weather["wind_speed"] / 20, 1.0),  # Normalize: 20 m/s = max
            "temperature": min(max(weather["temperature"] - 5, 0) / 40, 1.0),  # 5-45°C range
            "aqi": min(aqi["aqi"] / 300, 1.0),  # Normalize: 300 = max
            "traffic": traffic["delay_ratio"] - 0.8,  # 0.8-1.5 → 0-0.7
            "hour": (datetime.now().hour / 24),  # 0-24 → 0-1
        }

        return features
