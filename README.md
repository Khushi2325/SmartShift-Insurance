# SmartShift

SmartShift is a full-stack demo for delivery-worker income protection. It combines weather and air-quality risk signals, weekly micro-insurance plans, and an automated parametric claim workflow.

## Stack

- React + TypeScript + Vite
- Tailwind + shadcn/ui
- Node.js + Express
- PostgreSQL (Neon compatible) + Drizzle

## Key Features

- Worker and admin login modes
- Dynamic risk scoring (rain, AQI, temperature)
- Plan purchase and activation
- Automatic claim trigger and wallet credit based on measurable disruption thresholds
- Dashboard rehydration from backend on login and page load

## Project Structure

```text
.
├── server/                 # Express backend
├── src/                    # React frontend
├── lib/db/                 # Drizzle schema and migration utilities
├── public/                 # Static assets
└── package.json
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (Neon or local)

## Environment

Copy `.env.example` to `.env` and fill in values.

```env
VITE_RAZORPAY_KEY_ID=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
DATABASE_URL=postgresql://...
PORT=8080
```

## Install

```bash
npm install
```

## Database

Apply schema to your database:

```bash
npm run db:apply
```

Optional Drizzle commands:

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

## Run

Run backend and frontend together:

```bash
npm run dev:full
```

Or run separately:

```bash
npm run server
npm run dev
```

Frontend: http://localhost:5173

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Publishing To GitHub Checklist

- `.env` is not committed
- `node_modules/` is not committed
- `dist/` is not committed
- CI workflow is present in `.github/workflows/ci.yml`
- README reflects actual scripts and structure

## License

MIT
