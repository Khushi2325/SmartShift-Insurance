type WorkerPayload = {
  name: string;
  email: string;
  city: string;
  persona_type?: "rain" | "pollution" | "normal";
  delivery_partner?: "Zomato" | "Swiggy" | "Amazon" | "Blinkit";
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
  return postJson("/api/db/claims", payload);
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
  const response = await fetch(`/api/db/workers/portal?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch worker portal state");
  }

  return response.json() as Promise<{
    worker: {
      id: number;
      name: string;
      email: string;
      city: string;
      persona_type: "rain" | "pollution" | "normal";
      delivery_partner: "Zomato" | "Swiggy" | "Amazon" | "Blinkit";
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
    recentClaims: Array<{
      id: number;
      worker_id: number;
      trigger_type: string;
      payout_amount: number;
      status: string;
      auto_generated: boolean;
      reviewer: string | null;
      review_reason: string | null;
      reviewed_at: string | null;
      created_at: string;
    }>;
  }>;
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
