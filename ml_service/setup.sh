#!/bin/bash

# ML Model Setup Script
# Run this to install dependencies and train the model

echo "🚀 SmartShift ML Pipeline Setup"
echo "=================================="

# Navigate to ml_service
cd ml_service

echo ""
echo "📦 Step 1: Installing Python dependencies..."
pip install pandas numpy scikit-learn xgboost shap joblib flask flask-cors requests

echo ""
echo "🤖 Step 2: Training ML model..."
echo "(This will collect real API data and train the model)"
python ml_models/train_model.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Model training complete!"
    echo ""
    echo "📁 Generated files:"
    echo "   - ml_models/risk_model.pkl"
    echo "   - ml_models/shap_explainer.pkl"
    echo "   - ml_models/feature_names.pkl"
    echo "   - ml_models/training_data.csv"
    echo ""
    echo "🚀 Step 3: Starting ML API server..."
    echo "   (Open another terminal to run this)"
    echo ""
    echo "   python app_ml.py"
    echo ""
    echo "   API will be available at http://localhost:5001"
    echo ""
    echo "🧪 Step 4: Test the API"
    echo "   curl -X POST http://localhost:5001/predict \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{"
    echo '       "rain": 15,'
    echo '       "rain_prob": 70,'
    echo '       "wind": 8,'
    echo '       "temperature": 35,'
    echo '       "aqi": 200,'
    echo '       "traffic_delay": 1.5,'
    echo '       "hour": 19'
    echo "     }'"
    echo ""
else
    echo "❌ Model training failed!"
    exit 1
fi
