# SmartShift Insurance

An AI-powered parametric insurance platform for delivery workers (Zomato, Swiggy, Amazon, Blinkit) in India.

The platform predicts disruption risks and automatically triggers payouts — no manual claims needed — while also helping workers optimize their shifts to reduce income loss.

---

## Why SmartShift Insurance?

- **SmartShift** represents intelligent shift planning — helping delivery workers adapt their working hours based on predicted risk  
- **Insurance** represents financial protection — ensuring workers are compensated when disruptions still occur  

Together, the platform focuses on both **preventing income loss** and **protecting against real-world uncertainties**, making it more than just a traditional insurance solution.

---

## Features

- **Worker Dashboard** — weekly earnings, risk level, insurance status, shift recommendations  
- **AI Risk Prediction** — weather + AQI + temperature based risk scoring per city  
- **Smart Shift Recommender** — AI-suggested optimal working hours  
- **Dynamic Weekly Insurance** — risk-based premium calculation  
- **Parametric Claim Automation** — automatic payouts triggered by conditions  
- **Payment Simulation** — instant payout with transaction history  
- **Fraud Detection** — flags suspicious activity  
- **Admin Dashboard** — platform analytics and user management  

---

## How the AI Works

The system uses:

- Weather data (rainfall, temperature)  
- Air Quality Index (AQI)  

It calculates a **risk score** for each city:

- High → disruption likely  
- Medium → moderate risk  
- Low → safe  

This risk score drives:

- Premium calculation  
- Shift recommendations  
- Automatic claim triggering  

This ensures fast, transparent, and automated decision-making.  
**This ensures decisions are transparent and explainable, unlike black-box AI systems.**

---

## Market Crash Handling (System Adaptability)

The platform is designed to handle sudden regulatory or system disruptions:

- Configurable risk thresholds and payout triggers  
- Centralized control for quick updates  
- Continuous system operation without downtime  

This ensures resilience even during unexpected market changes.

---

## Adversarial Defense & Anti-Spoofing Strategy

Parametric systems are vulnerable to exploitation, especially through GPS spoofing attacks. To ensure robustness, SmartShift incorporates multiple layers of defense beyond basic location verification.

### Differentiation: Real vs Spoofed Behavior

- Detects unnatural movement patterns  
- Identifies sudden location jumps or static behavior during high-risk events  
- Compares historical activity and movement continuity  

### Multi-Signal Data Analysis

- Device-level consistency (device ID, session behavior)  
- Network patterns (IP changes, irregular access)  
- Activity logs (login times, shift participation)  
- Environmental correlation with real-world disruption data  

### UX Balance for Honest Workers

- Suspicious claims are flagged, not rejected immediately  
- Workers are not penalized instantly  
- Secondary validation ensures fairness  

### System Resilience

- Fraud detection rules are configurable  
- System adapts to evolving attack patterns  

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod |
| API Contract | OpenAPI 3.1 + Orval |
| Charts | Recharts |
| Package Manager | pnpm |

---

## Project Structure
```
smartshift-insurance/
├── artifacts/
│ ├── api-server/
│ │ └── src/
│ │ ├── lib/
│ │ └── routes/
│ └── smartshift/
│ └── src/
│ ├── pages/
│ ├── components/
│ └── hooks/
├── lib/
│ ├── api-spec/
│ ├── api-client-react/
│ ├── api-zod/
│ └── db/
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```
---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL database

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/smartshift-insurance.git
   cd smartshift-insurance
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set environment variables**

   Create a `.env` file (or set these in your environment):
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/smartshift
   PORT=8080
   ```

4. **Push database schema**
   ```bash
   pnpm --filter @workspace/db run push
   ```

5. **Start the backend**
   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

6. **Start the frontend** (in a new terminal)
   ```bash
   pnpm --filter @workspace/smartshift run dev
   ```

7. Open `http://localhost:5173` in your browser.

### Regenerate API types (after changing openapi.yaml)

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartshift.in | admin123 |
| Worker | raju@test.in | test123 |

> After first run, manually set `is_admin = true` in the database for the admin account:
> ```sql
> UPDATE workers SET is_admin = true WHERE email = 'admin@smartshift.in';
> ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a worker |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current session |
| GET | `/api/workers/:id/dashboard` | Full dashboard data |
| GET | `/api/risk/predict?city=X` | AI risk prediction |
| GET | `/api/risk/shifts?city=X` | Shift recommendations |
| GET | `/api/insurance/plans?city=X&riskLevel=Y` | Insurance plans |
| POST | `/api/insurance/activate` | Buy insurance |
| POST | `/api/claims` | Trigger a claim |
| POST | `/api/claims/process-auto` | Auto-process claims by city |
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/fraud-alerts` | Fraud alerts |

## Supported Cities

Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata, Ahmedabad, Jaipur, Lucknow (+ any city with generated mock data)

## License

MIT
