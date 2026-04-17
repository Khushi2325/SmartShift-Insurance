@echo off
REM ML Model Setup Script (Windows)
REM Run this to install dependencies and train the model

echo.
echo ========================================
echo    SmartShift ML Pipeline Setup
echo ========================================
echo.

cd ml_service

echo Step 1: Installing Python dependencies...
echo.
pip install pandas numpy scikit-learn xgboost shap joblib flask flask-cors requests

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo Step 2: Training ML model...
echo (This will collect real API data and train the model)
echo.
python ml_models/train_model.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Model training failed!
    exit /b 1
)

echo.
echo ========================================
echo     SUCCESS: Model training complete!
echo ========================================
echo.
echo Generated files:
echo   - ml_models\risk_model.pkl
echo   - ml_models\shap_explainer.pkl
echo   - ml_models\feature_names.pkl
echo   - ml_models\training_data.csv
echo.
echo Step 3: Starting ML API server...
echo (Run this in a new terminal)
echo.
echo   python app_ml.py
echo.
echo   API will be available at http://localhost:5001
echo.
echo Step 4: Test the API
echo.
echo   Invoke-RestMethod -Uri http://localhost:5001/health -Method Get
echo.
pause
