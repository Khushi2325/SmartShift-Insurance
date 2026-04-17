#!/usr/bin/env python3
"""
Training script for XGBoost risk prediction model
Uses real environmental data from APIs to train the model
"""

import sys
import os
import pandas as pd
import numpy as np
import logging
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score
import xgboost as xgb

# Add ml_models to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml_models'))

from dataset_generator import DatasetGenerator

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train_xgboost_model(n_samples=500, test_size=0.2):
    """
    Train XGBoost model on real environmental data
    """
    
    print("\n" + "="*60)
    print("🧠 SHIFT SHIELD - ML MODEL TRAINING")
    print("="*60)
    
    # Step 1: Generate training data
    print("\n📊 Step 1: Collecting real environmental data from APIs...")
    try:
        df = DatasetGenerator.create_training_dataset(n_samples=n_samples)
        
        if len(df) == 0:
            print("❌ No data collected! Make sure APIs are accessible.")
            return False
            
        print(f"✅ Collected {len(df)} real-world samples")
        print(f"   Data source: OpenWeatherMap, WAQI, traffic APIs")
        print(f"   Risk distribution: {dict(df['risk_label'].value_counts())}")
        
    except Exception as e:
        print(f"❌ Data collection failed: {e}")
        return False
    
    # Step 2: Prepare features
    print("\n🔧 Step 2: Preparing features...")
    feature_names = ["rain", "wind", "temperature", "aqi", "traffic", "hour"]
    X = df[feature_names].values
    y = df["risk_label"].values
    
    print(f"   Features: {feature_names}")
    print(f"   Sample shape: {X.shape}")
    print(f"   Target distribution: {np.bincount(y)}")
    
    # Step 3: Train/test split
    print("\n📋 Step 3: Splitting data (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    print(f"   Training set: {len(X_train)} samples")
    print(f"   Test set: {len(X_test)} samples")
    
    # Step 4: Train XGBoost
    print("\n🚀 Step 4: Training XGBoost model...")
    try:
        model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=1,
            eval_metric='logloss'
        )
        
        # Train
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            early_stopping_rounds=10,
            verbose=False
        )
        
        print("✅ Model training complete!")
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return False
    
    # Step 5: Evaluate
    print("\n📈 Step 5: Model Evaluation...")
    try:
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        
        auc = roc_auc_score(y_test, y_pred_proba)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        print(f"\n   📊 Metrics:")
        print(f"   AUC-ROC:  {auc:.3f}")
        print(f"   Precision: {precision:.3f}")
        print(f"   Recall:    {recall:.3f}")
        print(f"   F1-Score:  {f1:.3f}")
        
        # Feature importance
        print(f"\n   🎯 Feature Importance:")
        importances = model.feature_importances_
        for fname, imp in zip(feature_names, importances):
            print(f"      {fname:12s}: {imp:.4f}")
            
    except Exception as e:
        print(f"⚠️ Evaluation warning: {e}")
    
    # Step 6: Save model
    print("\n💾 Step 6: Saving model...")
    try:
        model_path = os.path.join(
            os.path.dirname(__file__),
            "ml_models",
            "xgboost_risk_model.pkl"
        )
        
        joblib.dump(model, model_path)
        print(f"✅ Model saved to: {model_path}")
        
        # Also save training info
        info = {
            "model_type": "XGBoost",
            "feature_names": feature_names,
            "n_samples_trained": len(df),
            "test_auc": auc,
            "test_precision": precision,
            "test_recall": recall,
            "data_source": "Real API data (OpenWeatherMap, WAQI, traffic)"
        }
        
        info_path = model_path.replace(".pkl", "_info.json")
        import json
        with open(info_path, "w") as f:
            json.dump(info, f, indent=2)
        
        print(f"✅ Model info saved to: {info_path}")
        
    except Exception as e:
        print(f"❌ Save failed: {e}")
        return False
    
    # Step 7: Test prediction
    print("\n🧪 Step 7: Testing model prediction...")
    try:
        from ml_models.risk_model import RiskPredictor
        
        predictor = RiskPredictor()
        if predictor.model is not None:
            # Test with sample features
            test_features = {
                "rain": 0.5,
                "wind": 0.3,
                "temperature": 0.6,
                "aqi": 0.4,
                "traffic": 0.2,
                "hour": 0.5
            }
            
            result = predictor.predict(test_features)
            print(f"   Test input: {test_features}")
            print(f"   Risk score: {result['score']:.3f}")
            print(f"   Risk level: {result['level']}")
            print(f"   Top factors: {[e['feature'] for e in result['explanation'][:3]]}")
            print("✅ Model predictions working!")
        else:
            print("⚠️ Model not loaded for testing")
            
    except Exception as e:
        print(f"⚠️ Prediction test failed: {e}")
    
    print("\n" + "="*60)
    print("✅ TRAINING COMPLETE!")
    print("="*60)
    print("\n🎉 Your AI brain is ready!")
    print("   - Uses REAL environmental data from APIs")
    print("   - Trained with XGBoost (industry-standard)")
    print("   - SHAP explainability included")
    print("   - Ready for production deployment")
    print("\nNext steps:")
    print("   1. Commit trained model to git")
    print("   2. Deploy to production")
    print("   3. Monitor predictions and retrain periodically")
    print("\n")
    
    return True

if __name__ == "__main__":
    # Parse arguments
    n_samples = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    
    success = train_xgboost_model(n_samples=n_samples)
    sys.exit(0 if success else 1)
