#!/bin/bash
# ml_service/run_training.sh
# Comprehensive ML model training and setup

set -e

echo "=========================================="
echo "🧠 SHIFT SHIELD ML MODEL TRAINING"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Python
echo -e "${BLUE}Step 1: Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✅ Found: $PYTHON_VERSION${NC}"
echo ""

# Step 2: Check dependencies
echo -e "${BLUE}Step 2: Checking ML dependencies...${NC}"
python3 -c "import xgboost; print('✅ XGBoost installed')" 2>/dev/null || \
  { echo "❌ XGBoost not found"; exit 1; }
python3 -c "import shap; print('✅ SHAP installed')" 2>/dev/null || \
  { echo "❌ SHAP not found"; exit 1; }
python3 -c "import pandas; print('✅ Pandas installed')" 2>/dev/null || \
  { echo "❌ Pandas not found"; exit 1; }
echo ""

# Step 3: Train model
echo -e "${BLUE}Step 3: Training XGBoost model...${NC}"
echo "   Collecting real API data..."
echo "   Generating labels..."
echo "   Training model..."
echo ""

# Determine number of samples
SAMPLES=${1:-300}
echo -e "${YELLOW}   → Training with $SAMPLES samples${NC}"

python3 train.py $SAMPLES
TRAIN_EXIT_CODE=$?

if [ $TRAIN_EXIT_CODE -ne 0 ]; then
    echo -e "${YELLOW}❌ Training failed. Check the output above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ MODEL TRAINING COMPLETE!"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Start the ML service:"
echo "   ${YELLOW}python3 ml_api.py${NC}"
echo ""
echo "2. Test the service (in another terminal):"
echo "   ${YELLOW}curl -X POST http://localhost:5001/api/ml/risk \\${NC}"
echo "   ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo "   ${YELLOW}  -d '{\"city\": \"Mumbai\"}' | python3 -m json.tool${NC}"
echo ""
echo "3. Integrate with backend:"
echo "   ${YELLOW}The Node.js backend will call /api/ml/risk${NC}"
echo ""
