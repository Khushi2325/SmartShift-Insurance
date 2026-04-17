# ml_service/ml_models/dataset_generator.py
# Generate training dataset using real API data + simulated labels

import pandas as pd
import numpy as np
import logging
from typing import Tuple, List
from data_pipeline import DataCollector

logger = logging.getLogger(__name__)

class DatasetGenerator:
    """Generate training dataset from real environmental data"""

    CITIES = [
        "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
        "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"
    ]

    @staticmethod
    def generate_risk_label(features: dict) -> int:
        """
        Generate risk label using realistic simulation logic.
        
        This simulates disruption likelihood based on environmental factors.
        """
        # Weighted combination of factors
        risk_score = (
            0.35 * features["rain"] +          # Rain most important for delivery
            0.25 * (features["aqi"] / 1.0) +   # Air quality
            0.15 * features["wind"] +          # Wind speed
            0.15 * features["traffic"] +       # Traffic conditions
            0.10 * (features["hour"] > 0.25) * (features["hour"] < 0.58)  # Peak hours (6am-2pm)
        )

        # Add some randomness (real disruptions are not 100% deterministic)
        noise = np.random.normal(0, 0.1)
        risk_score = np.clip(risk_score + noise, 0, 1)

        # Convert to binary: high risk = 1
        return 1 if risk_score > 0.5 else 0

    @staticmethod
    def create_training_dataset(n_samples: int = 1000, cities: List[str] = None) -> pd.DataFrame:
        """
        Create training dataset by:
        1. Collecting real environmental data from APIs
        2. Generating simulated disruption labels
        """
        if cities is None:
            cities = DatasetGenerator.CITIES

        dataset = []
        logger.info(f"Generating {n_samples} training samples from real API data...")

        for i in range(n_samples):
            city = np.random.choice(cities)
            
            try:
                # Collect REAL environmental data
                features = DataCollector.collect_features(city)
                
                # Generate simulated label
                label = DatasetGenerator.generate_risk_label(features)

                dataset.append({
                    **features,
                    "risk_label": label,
                    "city": city,
                    "sample_id": i
                })

                if (i + 1) % 100 == 0:
                    logger.info(f"Generated {i + 1}/{n_samples} samples")

            except Exception as e:
                logger.error(f"Error generating sample {i}: {e}")
                continue

        df = pd.DataFrame(dataset)
        logger.info(f"Dataset created: {len(df)} samples")
        return df

    @staticmethod
    def save_dataset(df: pd.DataFrame, filepath: str = "training_data.csv"):
        """Save dataset to CSV"""
        df.to_csv(filepath, index=False)
        logger.info(f"Dataset saved to {filepath}")

    @staticmethod
    def load_dataset(filepath: str = "training_data.csv") -> pd.DataFrame:
        """Load dataset from CSV"""
        df = pd.read_csv(filepath)
        logger.info(f"Loaded {len(df)} samples from {filepath}")
        return df

# Example usage
if __name__ == "__main__":
    # Generate dataset
    df = DatasetGenerator.create_training_dataset(n_samples=200)  # Start small for testing
    print("\nDataset Preview:")
    print(df.head(10))
    print(f"\nDataset shape: {df.shape}")
    print(f"Risk distribution:\n{df['risk_label'].value_counts()}")
    
    # Save for training
    DatasetGenerator.save_dataset(df)
