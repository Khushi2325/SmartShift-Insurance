import { UserSession } from "@/lib/session";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DemoEventType = "Rain" | "AQI";
export type FraudScenario = "none" | "sudden-jump" | "static-location";

export interface RiskMetrics {
  rainfallMm: number;
  rainProbability: number;
  aqi: number;
  temperature: number;
  activity?: number;
}

export interface RiskBreakdown {
  rainWeight: number;
  aqiWeight: number;
  tempWeight: number;
  rainFactor: number;
  aqiFactor: number;
  tempFactor: number;
  rainContribution: number;
  aqiContribution: number;
  tempContribution: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  breakdown: RiskBreakdown;
}

export interface RiskForecastPoint {
  hour: string;
  riskScore: number;
  riskLevel: RiskLevel;
}

export interface WeeklyPremiumBreakdown {
  basePremium: number;
  rainRiskAdjustment: number;
  pollutionRiskAdjustment: number;
  loyaltyDiscount: number;
  finalPremium: number;
}

export interface DemoTransaction {
  id: string;
  kind: "PREMIUM" | "PAYOUT";
  amount: number;
  status: "Credited" | "Debited" | "Under Review" | "Rejected";
  label: string;
  eventType?: DemoEventType;
  createdAt: string;
}

export interface LastPayoutEvent {
  eventType: DemoEventType;
  amount: number;
  status: "Credited" | "Under Review" | "Rejected";
  timestamp: string;
}

export interface RegisteredWorkerProfile {
  name: string;
  email: string;
  city: string;
  personaType: UserSession["persona_type"];
  deliveryPartner: UserSession["deliveryPartner"];
  createdAt: string;
  lastSeenAt: string;
}

export type ClaimReviewStatus = "Pending Approval" | "Approved" | "Rejected";
export type ClaimReviewVerdict = "Approve" | "Manual Review" | "Reject";

export interface ClaimReview {
  id: string;
  dbClaimId?: number | null;
  workerEmail: string;
  workerName: string;
  city: string;
  triggerType: DemoEventType;
  requestedAt: string;
  payoutAmount: number;
  expectedIncome: number;
  loss: number;
  coverageLimit: number;
  rainMm: number;
  activity: number;
  riskScore: number;
  riskLevel: RiskLevel;
  activePolicy: boolean;
  validTimeWindow: boolean;
  thresholdMet: boolean;
  fraudReason: string | null;
  aiVerdict: ClaimReviewVerdict;
  aiConfidence: number;
  status: ClaimReviewStatus;
  reviewer: string | null;
  reviewReason: string | null;
}

export interface WorkerDemoState {
  riskLevel: RiskLevel;
  weeklyPremium: number;
  walletBalance: number;
  transactions: DemoTransaction[];
  lastEvent: LastPayoutEvent | null;
  fraudStatus: "Clear" | "Suspicious" | "Under Review";
  fraudReason: string | null;
  claimReviewStatus?: ClaimReviewStatus | null;
  claimReviewId?: string | null;
  claimReviewReason?: string | null;
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
  workerProfiles: Record<string, RegisteredWorkerProfile>;
  claims: ClaimReview[];
}

const DEMO_STORE_KEY = "smartshift_demo_store_v2";
const FRAUD_FLAGS_KEY = "smartshift_fraud_flags_v2";

const baseWorkerState = (): WorkerDemoState => ({
  riskLevel: "LOW",
  weeklyPremium: 49,
  walletBalance: 0,
  transactions: [],
  lastEvent: null,
  fraudStatus: "Clear",
  fraudReason: null,
  claimReviewStatus: null,
  claimReviewId: null,
  claimReviewReason: null,
});

const getStore = (): DemoStore => {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) {
    return { workers: {}, workerProfiles: {}, claims: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    return {
      workers: parsed.workers || {},
      workerProfiles: parsed.workerProfiles || {},
      claims: parsed.claims || [],
    };
  } catch {
    return { workers: {}, workerProfiles: {}, claims: [] };
  }
};

const saveStore = (store: DemoStore) => {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
};

const upsertWorkerProfile = (profile: RegisteredWorkerProfile) => {
  const store = getStore();
  store.workerProfiles[profile.email] = profile;
  saveStore(store);
};

export const saveRegisteredWorkerProfile = (user: Pick<UserSession, "name" | "email" | "city" | "persona_type" | "deliveryPartner">) => {
  const current = getStore().workerProfiles[user.email];
  upsertWorkerProfile({
    name: user.name,
    email: user.email,
    city: user.city,
    personaType: user.persona_type,
    deliveryPartner: user.deliveryPartner,
    createdAt: current?.createdAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
};

export const getRegisteredWorkerProfiles = (): RegisteredWorkerProfile[] => {
  const store = getStore();
  return Object.values(store.workerProfiles).sort((a, b) => +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt));
};

const upsertClaimReview = (claim: ClaimReview) => {
  const store = getStore();
  const claims = store.claims.filter((item) => item.id !== claim.id);
  store.claims = [claim, ...claims];
  saveStore(store);
};

export const getClaimReviews = (): ClaimReview[] => {
  return getStore().claims.sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt));
};

export const linkClaimReviewToDbId = (claimId: string, dbClaimId: number) => {
  const store = getStore();
  store.claims = store.claims.map((item) => (item.id === claimId ? { ...item, dbClaimId } : item));
  saveStore(store);
};

export const submitClaimReview = (
  user: Pick<UserSession, "email" | "name" | "city" | "persona_type" | "deliveryPartner">,
  payload: {
    triggerType: DemoEventType;
    payoutAmount: number;
    expectedIncome: number;
    loss: number;
    coverageLimit: number;
    rainMm: number;
    activity: number;
    riskScore: number;
    riskLevel: RiskLevel;
    activePolicy: boolean;
    validTimeWindow: boolean;
    thresholdMet: boolean;
    fraudReason: string | null;
  },
): { state: WorkerDemoState; claim: ClaimReview } => {
  const current = getWorkerDemoState(user);
  const requestedAt = new Date().toISOString();
  const aiVerdict: ClaimReviewVerdict = payload.activePolicy && payload.validTimeWindow && payload.thresholdMet && !payload.fraudReason
    ? "Approve"
    : !payload.activePolicy || !payload.thresholdMet || Boolean(payload.fraudReason)
      ? "Reject"
      : "Manual Review";

  const claim: ClaimReview = {
    id: `CLM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dbClaimId: null,
    workerEmail: user.email,
    workerName: user.name,
    city: user.city,
    triggerType: payload.triggerType,
    requestedAt,
    payoutAmount: payload.payoutAmount,
    expectedIncome: payload.expectedIncome,
    loss: payload.loss,
    coverageLimit: payload.coverageLimit,
    rainMm: payload.rainMm,
    activity: payload.activity,
    riskScore: payload.riskScore,
    riskLevel: payload.riskLevel,
    activePolicy: payload.activePolicy,
    validTimeWindow: payload.validTimeWindow,
    thresholdMet: payload.thresholdMet,
    fraudReason: payload.fraudReason,
    aiVerdict,
    aiConfidence: payload.riskScore,
    status: "Pending Approval",
    reviewer: null,
    reviewReason: null,
  };

  const next: WorkerDemoState = {
    ...current,
    lastEvent: {
      eventType: payload.triggerType,
      amount: payload.payoutAmount,
      status: "Under Review",
      timestamp: requestedAt,
    },
    claimReviewStatus: claim.status,
    claimReviewId: claim.id,
    claimReviewReason: payload.fraudReason || (aiVerdict === "Approve" ? "AI approved and queued for admin review" : "Queued for admin review"),
    transactions: [
      {
        id: makeId(),
        kind: "PAYOUT" as const,
        amount: payload.payoutAmount,
        status: "Under Review" as const,
        label: `${payload.triggerType} claim pending admin approval`,
        eventType: payload.triggerType,
        createdAt: requestedAt,
      },
      ...current.transactions,
    ].slice(0, 20),
  };

  saveWorkerDemoState(user, next);
  upsertClaimReview(claim);

  return { state: next, claim };
};

const replaceWorkerTransaction = (workerState: WorkerDemoState, transactionId: string, nextStatus: DemoTransaction["status"], nextLabel: string) => ({
  ...workerState,
  transactions: workerState.transactions.map((transaction) => (
    transaction.id === transactionId
      ? { ...transaction, status: nextStatus, label: nextLabel }
      : transaction
  )),
});

export const approveClaimReview = (claimId: string, reviewer = "Admin"): { claim: ClaimReview | null; state: WorkerDemoState | null } => {
  const store = getStore();
  const claim = store.claims.find((item) => item.id === claimId);
  if (!claim || claim.status !== "Pending Approval") return { claim: null, state: null };

  const workerState = store.workers[claim.workerEmail] || baseWorkerState();
  const creditedState = {
    ...workerState,
    walletBalance: workerState.walletBalance + claim.payoutAmount,
    lastEvent: {
      eventType: claim.triggerType,
      amount: claim.payoutAmount,
      status: "Credited" as const,
      timestamp: new Date().toISOString(),
    },
    claimReviewStatus: "Approved" as const,
    claimReviewReason: `Approved by ${reviewer}`,
    claimReviewId: claim.id,
  };

  const reviewedClaim: ClaimReview = {
    ...claim,
    status: "Approved",
    reviewer,
    reviewReason: `Approved by ${reviewer}`,
  };

  store.workers[claim.workerEmail] = replaceWorkerTransaction(
    creditedState,
    workerState.transactions.find((transaction) => transaction.status === "Under Review" && transaction.eventType === claim.triggerType)?.id || "",
    "Credited",
    `₹${claim.payoutAmount} credited after admin approval`,
  );
  store.claims = store.claims.map((item) => (item.id === claimId ? reviewedClaim : item));
  saveStore(store);

  return { claim: reviewedClaim, state: store.workers[claim.workerEmail] };
};

export const rejectClaimReview = (claimId: string, reviewer = "Admin", reviewReason = "Rejected after review"): { claim: ClaimReview | null; state: WorkerDemoState | null } => {
  const store = getStore();
  const claim = store.claims.find((item) => item.id === claimId);
  if (!claim || claim.status !== "Pending Approval") return { claim: null, state: null };

  const workerState = store.workers[claim.workerEmail] || baseWorkerState();
  const reviewedClaim: ClaimReview = {
    ...claim,
    status: "Rejected",
    reviewer,
    reviewReason,
  };

  store.workers[claim.workerEmail] = {
    ...workerState,
    lastEvent: {
      eventType: claim.triggerType,
      amount: claim.payoutAmount,
      status: "Rejected",
      timestamp: new Date().toISOString(),
    },
    claimReviewStatus: "Rejected",
    claimReviewReason: reviewReason,
    claimReviewId: claim.id,
    transactions: [
      {
        id: makeId(),
        kind: "PAYOUT" as const,
        amount: 0,
        status: "Rejected" as const,
        label: `${claim.triggerType} claim rejected by ${reviewer}`,
        eventType: claim.triggerType,
        createdAt: new Date().toISOString(),
      },
      ...workerState.transactions,
    ].slice(0, 20),
  };
  store.claims = store.claims.map((item) => (item.id === claimId ? reviewedClaim : item));
  saveStore(store);

  return { claim: reviewedClaim, state: store.workers[claim.workerEmail] };
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const calculateRisk = ({ rainProbability, aqi, temperature }: Pick<RiskMetrics, "rainProbability" | "aqi" | "temperature">): RiskResult => {
  const rainFactor = clamp(rainProbability / 100, 0, 1);
  const aqiFactor = clamp(aqi / 500, 0, 1);
  const tempFactor = clamp(temperature / 50, 0, 1);

  const rainContribution = 0.6 * rainFactor;
  const aqiContribution = 0.25 * aqiFactor;
  const tempContribution = 0.15 * tempFactor;

  const rawScore = rainContribution + aqiContribution + tempContribution;
  const riskScore = Number(clamp(rawScore, 0, 1).toFixed(2));

  let riskLevel: RiskLevel = "LOW";
  if (riskScore > 0.7) {
    riskLevel = "HIGH";
  } else if (riskScore > 0.4) {
    riskLevel = "MEDIUM";
  }

  return {
    riskScore,
    riskLevel,
    breakdown: {
      rainWeight: 0.6,
      aqiWeight: 0.25,
      tempWeight: 0.15,
      rainFactor,
      aqiFactor,
      tempFactor,
      rainContribution: Number(rainContribution.toFixed(3)),
      aqiContribution: Number(aqiContribution.toFixed(3)),
      tempContribution: Number(tempContribution.toFixed(3)),
    },
  };
};

export const calculateRiskLevel = (metrics: Pick<RiskMetrics, "rainProbability" | "aqi" | "temperature">): RiskLevel => {
  return calculateRisk(metrics).riskLevel;
};

export const calculatePremium = (riskScore: number): number => {
  if (riskScore > 0.7) return 109;
  if (riskScore > 0.4) return 79;
  return 49;
};

export const calculateWeeklyPremiumBreakdown = ({
  riskScore,
  rainProbability,
  aqi,
  claimFreeThisWeek = false,
}: {
  riskScore: number;
  rainProbability: number;
  aqi: number;
  claimFreeThisWeek?: boolean;
}): WeeklyPremiumBreakdown => {
  const basePremium = riskScore > 0.7 ? 109 : riskScore > 0.4 ? 79 : 49;
  const rainRiskAdjustment = rainProbability > 70 ? 0 : 0;
  const pollutionRiskAdjustment = aqi > 300 ? 0 : 0;
  const loyaltyDiscount = claimFreeThisWeek ? 0 : 0;
  const finalPremium = basePremium;

  return {
    basePremium,
    rainRiskAdjustment: rainProbability > 50 ? rainRiskAdjustment : Math.max(rainRiskAdjustment - 3, 5),
    pollutionRiskAdjustment,
    loyaltyDiscount,
    finalPremium: Math.round(finalPremium),
  };
};

export const premiumForRisk = (riskScore: number): number => {
  return calculatePremium(riskScore);
};

export const generateRiskForecast = (
  currentData: Pick<RiskMetrics, "rainProbability" | "aqi" | "temperature">,
): RiskForecastPoint[] => {
  const forecast: RiskForecastPoint[] = [];

  let rainProbability = currentData.rainProbability;
  let aqi = currentData.aqi;
  const temperature = currentData.temperature;

  for (let i = 1; i <= 6; i += 1) {
    rainProbability = clamp(rainProbability + (Math.random() * 10 - 5), 0, 100);
    aqi = clamp(aqi + (Math.random() * 20 - 10), 0, 500);

    const result = calculateRisk({ rainProbability, aqi, temperature });
    forecast.push({
      hour: `+${i}h`,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
    });
  }

  return forecast;
};

export const checkForClaim = ({
  rain,
  activity,
  aqi = 0,
  temperature = 0,
  coverageLimit = 800,
}: {
  rain: number;
  activity: number;
  aqi?: number;
  temperature?: number;
  coverageLimit?: number;
}) => {
  const hasDisruption = rain > 20 || temperature > 40 || aqi > 300 || rain > 100;
  if (hasDisruption && activity < 30) {
    let reason = "Income disruption detected";
    if (rain > 100) reason = "Flood risk disruption";
    else if (rain > 20) reason = "Heavy rain disruption";
    else if (temperature > 40) reason = "Heatwave disruption";
    else if (aqi > 300) reason = "Pollution disruption";

    return {
      triggered: true,
      payout: coverageLimit,
      reason,
    };
  }

  return { triggered: false as const };
};

export const payoutForMetrics = ({ rainfallMm, activity = 100 }: Pick<RiskMetrics, "rainfallMm" | "activity">): { eventType: DemoEventType; amount: number } | null => {
  const claim = checkForClaim({ rain: rainfallMm, activity });
  if (!claim.triggered) {
    return null;
  }

  return { eventType: "Rain", amount: claim.payout };
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

  if (fraudScenario === "static-location" && (metrics.rainfallMm > 20 || metrics.aqi > 300 || metrics.temperature > 40)) {
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
  claimTriggered: boolean;
  claimReason: string;
  fraudReason: string | null;
} => {
  const current = getWorkerDemoState(user);
  const riskResult = calculateRisk(metrics);
  const riskLevel = riskResult.riskLevel;
  const premium = premiumForRisk(riskResult.riskScore);
  const claim = checkForClaim({
    rain: metrics.rainfallMm,
    activity: metrics.activity ?? 100,
    aqi: metrics.aqi,
    temperature: metrics.temperature,
  });
  const payout = claim.triggered ? { eventType: "Rain" as const, amount: claim.payout } : null;
  const fraudResult = detectFraud(fraudScenario, metrics);

  const payoutAmount = payout?.amount || 0;
  const status = fraudResult.detected ? "Under Review" : payoutAmount > 0 ? "Under Review" : "Credited";

  const transaction: DemoTransaction = {
    id: makeId(),
    kind: "PAYOUT" as const,
    amount: payoutAmount,
    status,
    label: claim.triggered ? `Rain disruption auto-claim (${claim.reason})` : `${eventType} simulation (no payout)`,
    eventType: claim.triggered ? "Rain" : eventType,
    createdAt: new Date().toISOString(),
  };

  const next: WorkerDemoState = {
    ...current,
    riskLevel,
    weeklyPremium: premium,
    walletBalance: current.walletBalance,
    lastEvent: {
      eventType,
      amount: payoutAmount,
      status,
      timestamp: new Date().toISOString(),
    },
    fraudStatus: fraudResult.detected ? "Suspicious" : "Clear",
    fraudReason: fraudResult.reason,
    claimReviewStatus: payoutAmount > 0 ? "Pending Approval" : null,
    claimReviewReason: payoutAmount > 0 ? "Pending admin approval" : null,
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
    claimTriggered: claim.triggered,
    claimReason: claim.triggered ? claim.reason : "No trigger",
    fraudReason: fraudResult.reason,
  };
};
