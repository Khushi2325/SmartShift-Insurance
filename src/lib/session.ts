export type UserRole = "worker" | "admin";

export type AiRecommendationMode = "balanced" | "safety-first" | "earnings-first";

export interface UserPreferences {
  weatherAlerts: boolean;
  payoutAlerts: boolean;
  shiftReminders: boolean;
  marketingEmails: boolean;
  aiRecommendationMode: AiRecommendationMode;
  language: string;
}

export interface UserSession {
  name: string;
  email: string;
  city: string;
  phone?: string;
  vehicleType?: string;
  emergencyContact?: string;
  role: UserRole;
  policyActive: boolean;
  purchasedPlans: string[];
  preferences: UserPreferences;
}

const SESSION_KEY = "smartshift_user";

const defaultPreferences: UserPreferences = {
  weatherAlerts: true,
  payoutAlerts: true,
  shiftReminders: true,
  marketingEmails: false,
  aiRecommendationMode: "balanced",
  language: "English",
};

export const getSession = (): UserSession | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed.email || !parsed.name) return null;

    return {
      name: parsed.name,
      email: parsed.email,
      city: parsed.city || "",
      phone: parsed.phone || "",
      vehicleType: parsed.vehicleType || "",
      emergencyContact: parsed.emergencyContact || "",
      role: parsed.role === "admin" ? "admin" : "worker",
      policyActive: Boolean(parsed.policyActive),
      purchasedPlans: Array.isArray(parsed.purchasedPlans) ? parsed.purchasedPlans : [],
      preferences: {
        weatherAlerts: parsed.preferences?.weatherAlerts ?? defaultPreferences.weatherAlerts,
        payoutAlerts: parsed.preferences?.payoutAlerts ?? defaultPreferences.payoutAlerts,
        shiftReminders: parsed.preferences?.shiftReminders ?? defaultPreferences.shiftReminders,
        marketingEmails: parsed.preferences?.marketingEmails ?? defaultPreferences.marketingEmails,
        aiRecommendationMode: parsed.preferences?.aiRecommendationMode ?? defaultPreferences.aiRecommendationMode,
        language: parsed.preferences?.language ?? defaultPreferences.language,
      },
    };
  } catch {
    return null;
  }
};

export const setSession = (session: UserSession) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};