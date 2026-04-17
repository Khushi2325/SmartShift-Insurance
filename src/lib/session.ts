export type UserRole = "worker" | "admin";
export type PersonaType = "rain" | "pollution" | "normal";

export type AiRecommendationMode = "balanced" | "safety-first" | "earnings-first";
export type AppLanguage = "English" | "Hindi";
export type ThemeMode = "dark" | "light";

export interface UserPreferences {
  weatherAlerts: boolean;
  payoutAlerts: boolean;
  shiftReminders: boolean;
  marketingEmails: boolean;
  aiRecommendationMode: AiRecommendationMode;
  language: AppLanguage;
  theme: ThemeMode;
}

export interface UserSession {
  name: string;
  email: string;
  city: string;
  salary?: number;
  persona_type: PersonaType;
  deliveryPartner: "Zomato" | "Swiggy" | "Amazon" | "Blinkit";
  phone?: string;
  vehicleType?: string;
  emergencyContact?: string;
  _sessionToken?: number;
  role: UserRole;
  policyActive: boolean;
  purchasedPlans: string[];
  preferences: UserPreferences;
}

const SESSION_KEY = "smartshift_user";
const AUTH_TOKEN_KEY = "smartshift_auth_token";
export const SESSION_UPDATED_EVENT = "smartshift-session-updated";

const defaultPreferences: UserPreferences = {
  weatherAlerts: true,
  payoutAlerts: true,
  shiftReminders: true,
  marketingEmails: false,
  aiRecommendationMode: "balanced",
  language: "English",
  theme: "dark",
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
      salary: typeof parsed.salary === "number" ? parsed.salary : undefined,
      persona_type: parsed.persona_type === "pollution" || parsed.persona_type === "normal" ? parsed.persona_type : "rain",
      deliveryPartner: parsed.deliveryPartner === "Swiggy" || parsed.deliveryPartner === "Amazon" || parsed.deliveryPartner === "Blinkit" ? parsed.deliveryPartner : "Zomato",
      phone: parsed.phone || "",
      vehicleType: parsed.vehicleType || "",
      emergencyContact: parsed.emergencyContact || "",
      _sessionToken: typeof parsed._sessionToken === "number" ? parsed._sessionToken : 0,
      role: parsed.role === "admin" ? "admin" : "worker",
      policyActive: Boolean(parsed.policyActive),
      purchasedPlans: Array.isArray(parsed.purchasedPlans) ? parsed.purchasedPlans : [],
      preferences: {
        weatherAlerts: parsed.preferences?.weatherAlerts ?? defaultPreferences.weatherAlerts,
        payoutAlerts: parsed.preferences?.payoutAlerts ?? defaultPreferences.payoutAlerts,
        shiftReminders: parsed.preferences?.shiftReminders ?? defaultPreferences.shiftReminders,
        marketingEmails: parsed.preferences?.marketingEmails ?? defaultPreferences.marketingEmails,
        aiRecommendationMode: parsed.preferences?.aiRecommendationMode ?? defaultPreferences.aiRecommendationMode,
        language: parsed.preferences?.language === "Hindi" ? "Hindi" : "English",
        theme: parsed.preferences?.theme === "light" ? "light" : "dark",
      },
    };
  } catch {
    return null;
  }
};

export const setSession = (session: UserSession) => {
  const withToken: UserSession = {
    ...session,
    _sessionToken: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(withToken));
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
};