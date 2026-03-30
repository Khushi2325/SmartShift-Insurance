import { UserSession } from "@/lib/session";

export interface RegisteredUser {
  name: string;
  email: string;
  password: string;
  city: string;
  phone?: string;
  vehicleType?: string;
  emergencyContact?: string;
  role: "worker" | "admin";
  createdAt: string;
}

const USERS_KEY = "smartshift_users";

const disposableDomains = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
]);

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const getUsers = (): RegisteredUser[] => {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: RegisteredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const validateEmailAuthenticity = (email: string): { valid: boolean; message?: string } => {
  const normalized = email.trim().toLowerCase();
  if (!emailRegex.test(normalized)) {
    return { valid: false, message: "Please enter a valid email address." };
  }

  const domain = normalized.split("@")[1] || "";
  if (disposableDomains.has(domain)) {
    return { valid: false, message: "Disposable emails are not allowed. Use a real email." };
  }

  return { valid: true };
};

export const registerUser = (payload: Omit<RegisteredUser, "createdAt">): { ok: boolean; message?: string } => {
  const users = getUsers();
  const exists = users.some((user) => user.email.toLowerCase() === payload.email.toLowerCase());
  if (exists) {
    return { ok: false, message: "This email is already registered. Please log in." };
  }

  users.push({ ...payload, createdAt: new Date().toISOString() });
  saveUsers(users);
  return { ok: true };
};

export const authenticateUser = (
  email: string,
  password: string,
): { ok: boolean; message?: string; session?: UserSession } => {
  const users = getUsers();
  const user = users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return { ok: false, message: "Account not found. Please sign up first." };
  }

  if (user.password !== password) {
    return { ok: false, message: "Incorrect password." };
  }

  return {
    ok: true,
    session: {
      name: user.name,
      email: user.email,
      city: user.city,
      phone: user.phone || "",
      vehicleType: user.vehicleType || "",
      emergencyContact: user.emergencyContact || "",
      role: user.role,
      policyActive: false,
      purchasedPlans: [],
      preferences: {
        weatherAlerts: true,
        payoutAlerts: true,
        shiftReminders: true,
        marketingEmails: false,
        aiRecommendationMode: "balanced",
        language: "English",
        theme: "dark",
      },
    },
  };
};