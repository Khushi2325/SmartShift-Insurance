# SmartShift Insurance: Implementation Verification & Testing Guide

## ✅ What Was Fixed

### 1. **Automated Trigger Checker** (`server/triggerChecker.js`)
- **Problem**: No system was checking if weather/risk conditions matched plan triggers
- **Solution**: Background worker that runs every 5 minutes to:
  - Query all active insurance policies
  - Fetch latest weather/location data for each worker
  - Evaluate plan triggers:
    - **Day-Shield**: triggers on `Rainfall > 20 mm/hr` → payout ₹800
    - **Rush-Hour-Cover**: triggers on `AQI > 300` → payout ₹1200
    - **Night-Safety**: triggers on `Heatwave > 40°C` or `Flood risk` → payout ₹1600
  - Auto-create **Credited claims** when conditions match
  - Update worker wallet automatically
  - Prevents duplicate triggers within 24 hours

### 2. **Backend Integration** (`server/index.js`)
- Added trigger checker initialization at app startup
- Imports: `import { startTriggerChecker } from "./triggerChecker.js"`
- Starts before server listen: `startTriggerChecker(dbPool, 5 * 60 * 1000)`

### 3. **PayoutStatusCard Component** (`src/components/PayoutStatusCard.tsx`)
- **Before**: Showed only demo/simulation payout data
- **After**: 
  - Accepts optional `claim` prop from real DB
  - Displays actual claim data when available:
    - Claim ID and amount
    - Status: Credited ✅ / Under Review / Rejected
    - Trigger type (Rain/AQI/Heat/Flood)
    - Real timestamp from database
  - Falls back to demo event if no real claim

---

## 🧪 How to Test End-to-End

### **Test Scenario 1: Buy a Plan → Auto-Trigger on Weather**

#### Step 1: Worker Registration
```
POST /api/auth/register
{
  "name": "Raj Kumar",
  "email": "raj@delivery.com",
  "password": "password123",
  "city": "Mumbai",
  "delivery_partner": "Zomato"
}
```
Response will include `token` and `session` with worker ID.

#### Step 2: Select a Plan (e.g., Day-Shield)
In WorkerDashboard, click "Low Risk Plan" → triggers payment flow:
```
POST /api/payment/create-order
{ "amount": 49 }
```
Complete Razorpay checkout (simulate or use test keys).

After payment:
```
POST /api/db/policies
{
  "worker_email": "raj@delivery.com",
  "plan_id": "day-shield",
  "weekly_premium": 49,
  "risk_level": "LOW",
  "coverage_amount": 800,
  "status": "active"
}
```

#### Step 3: Simulate Weather That Matches Trigger
Send heavy rainfall location data:
```
POST /api/db/location-risk
{
  "worker_email": "raj@delivery.com",
  "city": "Mumbai",
  "latitude": 19.076,
  "longitude": 72.8777,
  "destination_latitude": 19.100,
  "destination_longitude": 72.900,
  "rain_probability": 90,
  "rain_mm": 25,               // ← ABOVE 20mm threshold
  "aqi": 120,
  "temperature": 28,
  "traffic_delay_ratio": 1.2,
  "rule_score": 0.65,
  "ai_score": 0.72,
  "hybrid_score": 0.68,
  "risk_level": "MEDIUM",
  "confidence": "high",
  "source": "test"
}
```

#### Step 4: Wait for Trigger Check (or force manually)
The trigger checker runs every 5 minutes. In the meantime:
```
GET /api/user/policy?email=raj@delivery.com
```
Should show active policy + wallet balance.

#### Step 5: Verify Auto-Claim Creation
After 5 minutes (or manually running trigger check), claim should exist:
```
GET /api/claim/latest?email=raj@delivery.com
```
Returns:
```json
{
  "claim": {
    "id": 123,
    "userId": 45,
    "triggers": ["rain"],
    "status": "Credited",
    "amount": 800,
    "createdAt": "2025-01-17T14:32:00.000Z"
  }
}
```

#### Step 6: Verify Wallet Credit
```
GET /api/user/policy?email=raj@delivery.com
```
Wallet balance should now show: **₹800** credited automatically.

#### Step 7: Dashboard Display
WorkerDashboard → PayoutStatusCard should show:
- **Event Type**: Heavy Rain 🌧️
- **Amount**: ₹800
- **Status**: Credited ✅
- **Timestamp**: Real timestamp from claim

---

### **Test Scenario 2: High-Risk Plan with AQI Trigger**

#### Step 1: Buy Rush-Hour-Cover (Medium Risk Plan)
Same flow but:
- Plan: `rush-hour-cover` (₹79)
- Trigger: `AQI > 300`
- Payout: ₹1200

#### Step 2: Send High AQI Location Data
```
POST /api/db/location-risk
{
  "worker_email": "amit@delivery.com",
  "city": "Delhi",
  "latitude": 28.6139,
  "longitude": 77.209,
  "rain_probability": 10,
  "rain_mm": 0,
  "aqi": 350,              // ← ABOVE 300 threshold
  "temperature": 38,
  "traffic_delay_ratio": 1.5,
  "rule_score": 0.75,
  "ai_score": 0.78,
  "hybrid_score": 0.76,
  "risk_level": "HIGH",
  "confidence": "high",
  "source": "test"
}
```

#### Step 3: Verify Claim (same as Scenario 1, Step 5-7)
Expected claim:
- Amount: ₹1200
- Status: Credited ✅

---

## 🔍 Debugging Commands

### Check if trigger checker is running:
Look at server logs during startup:
```
✓ Trigger checker initialized
```

### View all active policies:
```
SELECT * FROM insurance_policies WHERE status = 'active';
```

### View recent claims:
```
SELECT id, worker_id, payout_amount, status, created_at FROM claims ORDER BY created_at DESC LIMIT 10;
```

### Check worker wallet:
```
SELECT worker_id, balance, updated_at FROM wallets WHERE worker_id = <worker_id>;
```

### Check location risk logs (what trigger checker sees):
```
SELECT worker_id, city, rain_mm, aqi, temperature, risk_level, created_at FROM worker_location_risk_logs WHERE worker_id = <worker_id> ORDER BY created_at DESC LIMIT 5;
```

---

## 📋 Checklist for Deployment

- [x] Trigger checker code created (`triggerChecker.js`)
- [x] Server startup hooks updated (`index.js`)
- [x] PayoutStatusCard component supports real claims
- [x] Database tables verified (claims, wallets, worker_location_risk_logs)
- [ ] Razorpay keys configured in `.env`
- [ ] Database URL configured in `.env`
- [ ] Frontend built: `npm run build`
- [ ] Server tested: `npm run start`
- [ ] Real weather data flowing from frontend to DB
- [ ] Trigger checks firing every 5 minutes (check logs)
- [ ] Claims auto-creating on weather match
- [ ] Wallets crediting automatically

---

## ⚠️ Known Limitations & Next Steps

1. **Test Data vs. Real Weather**: This implementation works with ANY location risk data (not just real APIs). For production, integrate with:
   - Real weather APIs (already in `/api/ai/risk/assess`)
   - Traffic APIs (Mapbox already wired)
   - Air quality APIs (open-meteo already wired)

2. **Duplicate Prevention**: Claims only auto-trigger once per 24 hours per policy to prevent abuse

3. **Demo Fallback**: If no real claim exists, PayoutStatusCard falls back to demo data (you can disable this)

4. **One-Shot Trigger**: After first weather match + claim, won't auto-trigger again until 24h passes. This is intentional fraud prevention.

5. **Manual Testing**: Use the `/api/db/location-risk` endpoint to manually inject weather data for testing

---

## 🚀 Next Phase (Not Implemented Yet)

- [ ] Real-time location tracking from worker app
- [ ] Continuous weather polling for each worker
- [ ] Claim dispute/review dashboard
- [ ] Fraud detection model integration
- [ ] SMS/push notifications on payout
- [ ] Advanced analytics dashboard

