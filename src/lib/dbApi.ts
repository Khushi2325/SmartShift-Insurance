type WorkerPayload = {
  name: string;
  email: string;
  city: string;
  persona_type?: "rain" | "pollution" | "normal";
  delivery_partner?: "Zomato" | "Swiggy" | "Amazon" | "Blinkit";
};

export type ClaimLifecycleStatus = "pending" | "approved" | "rejected";

export type ClaimLifecycle = {
  id: number;
  userId: number;
  triggers: string[];
  status: ClaimLifecycleStatus;
  amount: number;
  createdAt: string;
};

const postJson = async (url: string, payload: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }

  return response.json();
};

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }

  return response.json() as Promise<T>;
};

export const syncWorkerToDb = async (payload: WorkerPayload) => {
  return postJson("/api/db/workers/upsert", payload);
};

export const syncRiskDataToDb = async (payload: {
  city: string;
  rain_probability: number;
  aqi: number;
  temperature: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
}) => {
  return postJson("/api/db/risk-data", payload);
};

export const syncInsurancePolicyToDb = async (payload: {
  worker_email: string;
  plan_id: string;
  weekly_premium: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  coverage_amount: number;
  status: string;
}) => {
  return postJson("/api/db/policies", payload);
};

export const syncClaimToDb = async (payload: {
  worker_email: string;
  trigger_type: string;
  payout_amount: number;
  status: string;
  auto_generated?: boolean;
  reviewer?: string | null;
  review_reason?: string | null;
}) => {
  return postJson("/api/claim", {
    worker_email: payload.worker_email,
    trigger_type: payload.trigger_type,
    amount: payload.payout_amount,
    status: payload.status,
    auto_generated: payload.auto_generated,
    reviewer: payload.reviewer,
    review_reason: payload.review_reason,
  });
};

export const creditWalletInDb = async (payload: {
  worker_email: string;
  amount: number;
  claim_id?: number | null;
}) => {
  return postJson("/api/wallet/credit", {
    worker_email: payload.worker_email,
    amount: payload.amount,
    claim_id: payload.claim_id,
  });
};

export const reviewClaimInDb = async (claimId: number, payload: {
  status: "Approved" | "Rejected";
  reviewer: string;
  review_reason: string;
}) => {
  const response = await fetch(`/api/db/claims/${claimId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed: /api/db/claims/${claimId}/review`);
  }

  return response.json();
};

export const fetchWorkerPortalState = async (email: string) => {
  return getJson<{
    worker: {
      id: number;
      name: string;
      email: string;
      city: string;
      persona_type: "rain" | "pollution" | "normal";
      delivery_partner: "Zomato" | "Swiggy" | "Amazon" | "Blinkit";
      active_plan: string | null;
      plan_start_time: string | null;
      plan_end_time: string | null;
      created_at: string;
    } | null;
    activePolicy: {
      id: number;
      worker_id: number;
      plan_id: string;
      weekly_premium: number;
      risk_level: "LOW" | "MEDIUM" | "HIGH";
      coverage_amount: number;
      status: string;
      created_at: string;
    } | null;
    wallet: {
      id: number;
      worker_id: number;
      balance: number;
      updated_at: string;
    } | null;
    walletBalance: number;
    latestClaim: {
      id: number;
      worker_id: number;
      trigger_type: string;
      triggers: string[];
      payout_amount: number;
      status: string;
      auto_generated: boolean;
      reviewer: string | null;
      review_reason: string | null;
      reviewed_at: string | null;
      created_at: string;
    } | null;
    recentClaims: Array<{
      id: number;
      worker_id: number;
      trigger_type: string;
      triggers: string[];
      payout_amount: number;
      status: string;
      auto_generated: boolean;
      reviewer: string | null;
      review_reason: string | null;
      reviewed_at: string | null;
      created_at: string;
    }>;
  }>(`/api/user/policy?email=${encodeURIComponent(email)}`);
};

export const fetchLatestClaim = async (email: string) => {
  return getJson<{ claim: {
    id: number;
    worker_id: number;
    trigger_type: string;
    triggers: string[];
    payout_amount: number;
    status: string;
    auto_generated: boolean;
    reviewer: string | null;
    review_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
  } | null }>(`/api/claim/latest?email=${encodeURIComponent(email)}`);
};

export const fetchLatestClaimByUserId = async (userId: number) => {
  return getJson<{ claim: ClaimLifecycle | null }>(`/api/claims/latest?userId=${encodeURIComponent(String(userId))}`);
};

export const createClaimLifecycle = async (payload: {
  userId: number;
  triggers: string[];
  amount: number;
}) => {
  return postJson("/api/claims/create", payload) as Promise<{ claim: ClaimLifecycle }>;
};

export const approveClaimLifecycle = async (claimId: number) => {
  return postJson(`/api/claims/${claimId}/approve`, {}) as Promise<{ claim: ClaimLifecycle; walletBalance: number }>;
};

export const rejectClaimLifecycle = async (claimId: number) => {
  return postJson(`/api/claims/${claimId}/reject`, {}) as Promise<{ claim: ClaimLifecycle }>;
};

export const fetchUserPolicy = async (email: string) => fetchWorkerPortalState(email);

export const fetchUserProfile = async (email: string) => {
  return getJson<{
    id: number;
    email: string;
    active_plan: string | null;
    plan_start_time: string | null;
    plan_end_time: string | null;
  }>(`/api/user/profile?email=${encodeURIComponent(email)}`);
};

export const reviewClaimOnDb = async (payload: {
  claimId: number;
  status: "Approved" | "Rejected";
  reviewer: string;
  review_reason: string;
}) => {
  return reviewClaimInDb(payload.claimId, {
    status: payload.status,
    reviewer: payload.reviewer,
    review_reason: payload.review_reason,
  });
};

export const syncFraudAlertToDb = async (payload: {
  worker_email: string;
  reason: string;
  flag_level: "LOW" | "MEDIUM" | "HIGH";
  resolved?: boolean;
}) => {
  return postJson("/api/db/fraud-alerts", payload);
};
