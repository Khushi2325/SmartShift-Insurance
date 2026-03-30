import { UserSession } from "@/lib/session";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DemoEventType = "Rain" | "AQI";
export type FraudScenario = "none" | "sudden-jump" | "static-location";

export interface RiskMetrics {
  rainfallMm: number;
  aqi: number;
}

export interface DemoTransaction {
  id: string;
  kind: "PREMIUM" | "PAYOUT";
  amount: number;
  status: "Credited" | "Debited" | "Under Review";
  label: string;
  eventType?: DemoEventType;
  createdAt: string;
}

export interface LastPayoutEvent {
  eventType: DemoEventType;
  amount: number;
  status: "Credited" | "Under Review";
  timestamp: string;
}

export interface WorkerDemoState {
  riskLevel: RiskLevel;
  weeklyPremium: number;
  walletBalance: number;
  transactions: DemoTransaction[];
  lastEvent: LastPayoutEvent | null;
  fraudStatus: "Clear" | "Suspicious" | "Under Review";
  fraudReason: string | null;
}

export interface FraudFlaggedUser {
  email: string;
  name: string;
  city: string;
  reason: string;
  status: "Under Review";
  timestamp: string;
}

interface DemoStore {
  workers: Record<string, WorkerDemoState>;
}

const DEMO_STORE_KEY = "smartshift_demo_store_v2";
const FRAUD_FLAGS_KEY = "smartshift_fraud_flags_v2";

const baseWorkerState = (): WorkerDemoState => ({
  riskLevel: "LOW",
  weeklyPremium: 20,
  walletBalance: 0,
  transactions: [],
  lastEvent: null,
  fraudStatus: "Clear",
  fraudReason: null,
});

const getStore = (): DemoStore => {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) {
    return { workers: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    return {
      workers: parsed.workers || {},
    };
  } catch {
    return { workers: {} };
  }
};

const saveStore = (store: DemoStore) => {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
};

const saveFlags = (flags: FraudFlaggedUser[]) => {
  localStorage.setItem(FRAUD_FLAGS_KEY, JSON.stringify(flags));
};

const getFlags = (): FraudFlaggedUser[] => {
  const raw = localStorage.getItem(FRAUD_FLAGS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const makeId = () => `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const calculateRiskLevel = ({ rainfallMm, aqi }: RiskMetrics): RiskLevel => {
  if (rainfallMm > 50) return "HIGH";
  if (aqi > 300) return "MEDIUM";
  return "LOW";
};

export const premiumForRisk = (riskLevel: RiskLevel): number => {
  if (riskLevel === "HIGH") return 60;
  if (riskLevel === "MEDIUM") return 40;
  return 20;
};

export const payoutForMetrics = ({ rainfallMm, aqi }: RiskMetrics): { eventType: DemoEventType; amount: number } | null => {
  const riskLevel = calculateRiskLevel({ rainfallMm, aqi });

  if (riskLevel === "HIGH") {
    return { eventType: "Rain", amount: 500 };
  }

  if (riskLevel === "MEDIUM") {
    return { eventType: "AQI", amount: 300 };
  }

  return null;
};

export const getWorkerDemoState = (user: Pick<UserSession, "email">): WorkerDemoState => {
  const store = getStore();
  return store.workers[user.email] || baseWorkerState();
};

export const saveWorkerDemoState = (user: Pick<UserSession, "email">, state: WorkerDemoState) => {
  const store = getStore();
  store.workers[user.email] = state;
  saveStore(store);
};

export const recordPremiumPayment = (
  user: Pick<UserSession, "email">,
  amount: number,
  planName: string,
): WorkerDemoState => {
  const current = getWorkerDemoState(user);
  const next: WorkerDemoState = {
    ...current,
    transactions: [
      {
        id: makeId(),
        kind: "PREMIUM",
        amount,
        status: "Debited",
        label: `Premium paid for ${planName}`,
        createdAt: new Date().toISOString(),
      },
      ...current.transactions,
    ],
  };

  saveWorkerDemoState(user, next);
  return next;
};

const detectFraud = (
  fraudScenario: FraudScenario,
  metrics: RiskMetrics,
): { detected: boolean; reason: string | null } => {
  if (fraudScenario === "sudden-jump") {
    return { detected: true, reason: "Location mismatch: sudden location jump detected" };
  }

  if (fraudScenario === "static-location" && (metrics.rainfallMm > 50 || metrics.aqi > 300)) {
    return { detected: true, reason: "Abnormal pattern: static location during high-risk disruption" };
  }

  return { detected: false, reason: null };
};

const upsertFlaggedUser = (flag: FraudFlaggedUser) => {
  const flags = getFlags();
  const filtered = flags.filter((item) => item.email !== flag.email);
  saveFlags([flag, ...filtered]);
};

export const getFlaggedUsers = (): FraudFlaggedUser[] => {
  return getFlags().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
};

export const simulateInsuranceEvent = (
  user: Pick<UserSession, "email" | "name" | "city">,
  eventType: DemoEventType,
  metrics: RiskMetrics,
  fraudScenario: FraudScenario,
): {
  state: WorkerDemoState;
  payoutAmount: number;
  status: "Credited" | "Under Review";
  riskLevel: RiskLevel;
  premium: number;
  fraudReason: string | null;
} => {
  const current = getWorkerDemoState(user);
  const riskLevel = calculateRiskLevel(metrics);
  const premium = premiumForRisk(riskLevel);
  const payout = payoutForMetrics(metrics);
  const fraudResult = detectFraud(fraudScenario, metrics);

  const payoutAmount = payout?.amount || 0;
  const status = fraudResult.detected ? "Under Review" : "Credited";

  const transaction: DemoTransaction = {
    id: makeId(),
    kind: "PAYOUT",
    amount: payoutAmount,
    status,
    label: payoutAmount > 0 ? `${eventType} disruption auto-claim` : `${eventType} simulation (no payout)`,
    eventType,
    createdAt: new Date().toISOString(),
  };

  const next: WorkerDemoState = {
    ...current,
    riskLevel,
    weeklyPremium: premium,
    walletBalance: fraudResult.detected ? current.walletBalance : current.walletBalance + payoutAmount,
    lastEvent: {
      eventType,
      amount: payoutAmount,
      status,
      timestamp: new Date().toISOString(),
    },
    fraudStatus: fraudResult.detected ? "Suspicious" : "Clear",
    fraudReason: fraudResult.reason,
    transactions: [transaction, ...current.transactions].slice(0, 20),
  };

  if (fraudResult.detected && fraudResult.reason) {
    upsertFlaggedUser({
      email: user.email,
      name: user.name,
      city: user.city,
      reason: fraudResult.reason,
      status: "Under Review",
      timestamp: new Date().toISOString(),
    });
    next.fraudStatus = "Under Review";
  }

  saveWorkerDemoState(user, next);

  return {
    state: next,
    payoutAmount,
    status,
    riskLevel,
    premium,
    fraudReason: fraudResult.reason,
  };
};
