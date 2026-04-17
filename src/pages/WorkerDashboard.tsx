import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, TrendingUp, CheckCircle2, Activity, User, LogOut, Receipt, Wallet, Settings, CircleUserRound, AlertTriangle, Sparkles, RotateCcw } from "lucide-react";
import { CloudRain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { clearSession, getSession, setSession, SESSION_UPDATED_EVENT, UserSession } from "@/lib/session";
import PayoutStatusCard from "@/components/PayoutStatusCard";
import {
  ClaimLifecycle,
  ClaimLifecycleStatus,
  createClaimLifecycle,
  fetchLatestClaimByUserId,
  fetchUserProfile,
  fetchWorkerPortalState,
  approveClaimLifecycle,
  fetchAiRiskAssessment,
  syncLocationRiskToDb,
  syncInsurancePolicyToDb,
  syncRiskDataToDb,
  syncWorkerToDb,
} from "@/lib/dbApi";
import { tx, useAppLanguage } from "@/lib/preferences";
import {
  calculateRisk,
  generateRiskForecast,
  getWorkerDemoState,
  calculateWeeklyPremiumBreakdown,
  recordPremiumPayment,
  saveWorkerDemoState,
  saveRegisteredWorkerProfile,
} from "@/lib/insuranceDemo";
import { calculateRisk as calculateRiskEngine, type RiskFactors } from "@/lib/riskEngine";
import { getAIRiskNarrative } from "@/lib/aiExplain";
import { fetchLiveWeather, fetchLiveAQI, fetchHourlyForecast } from "@/lib/weatherApi";
import { RiskExplainability } from "@/components/dashboard/RiskExplainability";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import { EarningsOptimization } from "@/components/dashboard/EarningsOptimization";

type TrendPoint = { time: string; score: number; hour: number };
type ShiftRecommendation = {
  time: string;
  risk: "Low" | "Medium" | "High";
  earnings: "Low" | "Medium" | "High";
  badge: "low" | "medium" | "high";
  reason: string;
  confidence: string;
};

const fallbackTrend: TrendPoint[] = [
  { time: "6AM", score: 0.2, hour: 6 },
  { time: "8AM", score: 0.35, hour: 8 },
  { time: "10AM", score: 0.55, hour: 10 },
  { time: "12PM", score: 0.72, hour: 12 },
  { time: "2PM", score: 0.68, hour: 14 },
  { time: "4PM", score: 0.45, hour: 16 },
  { time: "6PM", score: 0.3, hour: 18 },
  { time: "8PM", score: 0.25, hour: 20 },
];

const planCatalog = [
  { id: "day-shield", name: "Low Risk Plan", window: "Weekly protection cycle", premium: "₹49", payout: "₹800", triggers: "Rainfall > 20 mm/hr", bestFor: "Lower disruption cities" },
  { id: "rush-hour-cover", name: "Medium Risk Plan", window: "Weekly protection cycle", premium: "₹79", payout: "₹1200", triggers: "AQI > 300", bestFor: "Moderate disruption cities" },
  { id: "night-safety", name: "High Risk Plan", window: "Weekly protection cycle", premium: "₹109", payout: "₹1600", triggers: "Heatwave > 40°C or Flood risk", bestFor: "High disruption cities" },
];

const planNameHindi: Record<string, string> = {
  "Low Risk Plan": "लो रिस्क प्लान",
  "Medium Risk Plan": "मीडियम रिस्क प्लान",
  "High Risk Plan": "हाई रिस्क प्लान",
};

const planTriggerHindi: Record<string, string> = {
  "Rainfall > 20 mm/hr": "बारिश > 20 mm/hr",
  "AQI > 300": "AQI > 300",
  "Heatwave > 40°C or Flood risk": "तापमान > 40°C या बाढ़ जोखिम",
};

const planBestForHindi: Record<string, string> = {
  "Lower disruption cities": "कम व्यवधान वाले शहर",
  "Moderate disruption cities": "मध्यम व्यवधान वाले शहर",
  "High disruption cities": "उच्च व्यवधान वाले शहर",
};

const cityConditions: Record<string, { rain: string; rainMm: number; rainProbability: number; aqi: number; temp: string; risk: number }> = {
  Mumbai: { rain: "Heavy", rainMm: 56, rainProbability: 86, aqi: 142, temp: "36°C", risk: 0.72 },
  Delhi: { rain: "None", rainMm: 0, rainProbability: 12, aqi: 188, temp: "39°C", risk: 0.76 },
  Bangalore: { rain: "Light", rainMm: 3, rainProbability: 38, aqi: 74, temp: "29°C", risk: 0.31 },
  Chennai: { rain: "Moderate", rainMm: 19, rainProbability: 64, aqi: 102, temp: "35°C", risk: 0.58 },
};

const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Delhi: { latitude: 28.6139, longitude: 77.209 },
  Bangalore: { latitude: 12.9716, longitude: 77.5946 },
  Chennai: { latitude: 13.0827, longitude: 80.2707 },
};

const partnerIncomeProfile: Record<string, { daily: number; weekly: number }> = {
  Zomato: { daily: 920, weekly: 6440 },
  Swiggy: { daily: 980, weekly: 6860 },
  Amazon: { daily: 1100, weekly: 7700 },
  Blinkit: { daily: 1040, weekly: 7280 },
};

const cityIncomeMultiplier: Record<string, number> = {
  Mumbai: 1.12,
  Delhi: 1.08,
  Bangalore: 0.98,
  Chennai: 1.02,
  Vadodara: 0.94,
  Ahmedabad: 0.96,
  Surat: 0.95,
  Pune: 1.0,
};

const defaultCondition = { rain: "None", rainMm: 0, rainProbability: 0, aqi: 0, temp: "0°C", risk: 0.1 };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseTemperature = (value: string) => {
  const numeric = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const makeAutoClaimId = () => `AUTO-CLAIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const getRainLabel = (rainMm: number) => {
  if (rainMm >= 7) return "Heavy";
  if (rainMm >= 2) return "Moderate";
  if (rainMm > 0) return "Light";
  return "None";
};

const parseMoney = (value: string) => Number(value.replace(/[^0-9.]/g, ""));
const isSimulationOnlyPayout = (tx: { kind: string; label: string; status: string }) => (
  tx.kind === "PAYOUT"
  && tx.status === "Credited"
  && tx.label.toLowerCase().includes("wallet not credited")
);

const inferPlanIdFromPolicy = (policy: { plan_id?: string | null; coverage_amount?: number } | null) => {
  if (!policy) return null;
  if (policy.plan_id && policy.plan_id !== "unknown") return policy.plan_id;
  if (policy.coverage_amount === 800 || policy.coverage_amount === 500) return "day-shield";
  if (policy.coverage_amount === 1200 || policy.coverage_amount === 300) return "rush-hour-cover";
  if (policy.coverage_amount === 1600 || policy.coverage_amount === 350) return "night-safety";
  return null;
};

const normalizePlanId = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["day-shield", "rush-hour-cover", "night-safety"].includes(normalized)) return normalized;
  if (normalized === "day shield") return "day-shield";
  if (normalized === "rush hour cover") return "rush-hour-cover";
  if (normalized === "night safety") return "night-safety";
  return null;
};

const normalizeClaimLifecycleStatus = (status?: string | null): ClaimLifecycleStatus => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
};

const validateUPI = (upiId: string) => {
  // UPI format: username@provider
  // Allow alphanumerics, dots, hyphens, underscores before @
  // Allow alphanumerics and hyphens after @ (provider names)
  const upiRegex = /^[a-zA-Z0-9.\-_]{3,}@[a-zA-Z0-9\-]{2,}$/i;
  return upiRegex.test(upiId);
};

const getBadge = (riskScore: number): "low" | "medium" | "high" => {
  if (riskScore >= 0.65) return "high";
  if (riskScore >= 0.4) return "medium";
  return "low";
};

const toLabel = (hour: number) => `${((hour + 11) % 12) + 1}${hour >= 12 ? "PM" : "AM"}`;

const toTitleCase = (value: string) => value
  .split(" ")
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(" ");

const isPlaceholderCityLabel = (value: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;

  return [
    "live location",
    "live gps",
    "current location",
    "locating city",
    "unknown",
    "n/a",
    "na",
  ].includes(normalized);
};

const normalizeCityLabel = (value: string) => {
  const cleaned = String(value || "").trim();
  if (!cleaned || isPlaceholderCityLabel(cleaned)) return "";
  return toTitleCase(cleaned.replace(/\s+/g, " "));
};

const buildDynamicPersonaLabel = ({
  city,
  rainMm,
  rainProbability,
  aqi,
  temperature,
  riskScore,
}: {
  city: string;
  rainMm: number;
  rainProbability: number;
  aqi: number;
  temperature: number;
  riskScore: number;
}) => {
  const resolvedCity = normalizeCityLabel(city);
  const citySuffix = resolvedCity ? ` (${resolvedCity})` : "";

  if (riskScore >= 0.7 || rainMm >= 20 || rainProbability >= 70) {
    return `Rain-Heavy City Rider${citySuffix}`;
  }

  if (aqi >= 150) {
    return `Air-Quality Sensitive Rider${citySuffix}`;
  }

  if (temperature >= 38) {
    return `Heat-Stress Rider${citySuffix}`;
  }

  return `Balanced Conditions Rider${citySuffix}`;
};

const formatRupees = (amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

const estimateEarningsForWorker = ({
  deliveryPartner,
  city,
  riskScore,
  policyActive,
}: {
  deliveryPartner: string;
  city: string;
  riskScore: number;
  policyActive: boolean;
}) => {
  const partnerBase = partnerIncomeProfile[deliveryPartner] || partnerIncomeProfile.Zomato;
  const cityMultiplier = cityIncomeMultiplier[normalizeCityLabel(city)] || 1;
  const riskMultiplier = clamp(1 - (clamp(riskScore, 0, 1) * 0.18), 0.72, 1.02);
  const policyMultiplier = policyActive ? 1.03 : 1;

  const dailyEstimate = partnerBase.daily * cityMultiplier * riskMultiplier * policyMultiplier;
  const weeklyEstimate = partnerBase.weekly * cityMultiplier * riskMultiplier * policyMultiplier;

  return {
    dailyLow: formatRupees(dailyEstimate * 0.88),
    dailyHigh: formatRupees(dailyEstimate * 1.12),
    weeklyLow: formatRupees(weeklyEstimate * 0.88),
    weeklyHigh: formatRupees(weeklyEstimate * 1.12),
  };
};

const statusBadgeClass = (status: "ACTIVE" | "SAFE" | "MEDIUM") => {
  if (status === "ACTIVE") return "bg-risk-high-bg text-risk-high border border-risk-high/30";
  if (status === "MEDIUM") return "bg-risk-medium-bg text-risk-medium border border-risk-medium/30";
  return "bg-risk-low-bg text-risk-low border border-risk-low/30";
};

const loadRazorpayScript = async (): Promise<boolean> => {
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const buildRecommendations = (trend: TrendPoint[], mode: UserSession["preferences"]["aiRecommendationMode"]): ShiftRecommendation[] => {
  const slots = [
    { label: "6:00 AM - 9:00 AM", start: 6, end: 9 },
    { label: "9:00 AM - 12:00 PM", start: 9, end: 12 },
    { label: "12:00 PM - 3:00 PM", start: 12, end: 15 },
    { label: "5:00 PM - 8:00 PM", start: 17, end: 20 },
  ];

  return slots.map((slot) => {
    const points = trend.filter((item) => item.hour >= slot.start && item.hour <= slot.end);
    const avgRisk = points.length ? points.reduce((sum, item) => sum + item.score, 0) / points.length : 0.5;
    const badge = getBadge(avgRisk);
    const riskLabel = badge === "high" ? "High" : badge === "medium" ? "Medium" : "Low";

    const earnings = mode === "safety-first"
      ? (badge === "low" ? "Medium" : badge === "medium" ? "Low" : "Low")
      : mode === "earnings-first"
        ? (badge === "high" ? "High" : badge === "medium" ? "Medium" : "Medium")
        : (badge === "low" ? "High" : badge === "medium" ? "Medium" : "Low");

    const confidence = points.length >= 2 ? "High confidence" : "Moderate confidence";
    const reason = badge === "high"
      ? "Avoid long shifts unless necessary"
      : badge === "medium"
        ? "Work with short breaks and alerts on"
        : "Best slot for safer and stable work";

    return {
      time: slot.label,
      risk: riskLabel as "Low" | "Medium" | "High",
      earnings: earnings as "Low" | "Medium" | "High",
      badge,
      reason,
      confidence,
    };
  });
};

const WorkerDashboard = () => {
  const language = useAppLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserSession | null>(() => getSession());
  const [liveCondition, setLiveCondition] = useState<{ rain: string; rainMm: number; rainProbability: number; aqi: number; temp: string; risk: number } | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendPoint[]>(fallbackTrend);
  const [paymentPlanId, setPaymentPlanId] = useState<string | null>(null);
  const [upiId, setUpiId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const plansSectionRef = useRef<HTMLDivElement | null>(null);
  const [demoState, setDemoState] = useState(() => (user ? getWorkerDemoState(user) : getWorkerDemoState({ email: "" })));
  const [payoutCelebration, setPayoutCelebration] = useState<{ amount: number; walletBalance: number } | null>(null);
  const [workerId, setWorkerId] = useState<number | null>(null);
  const [latestClaim, setLatestClaim] = useState<ClaimLifecycle | null>(null);
  const [lastAutoClaimKey, setLastAutoClaimKey] = useState("");
  const [testTriggerNonce, setTestTriggerNonce] = useState(0);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [fraudFlags, setFraudFlags] = useState<{ type: string; severity: string; message: string }[]>([]);
  const [claimBlocked, setClaimBlocked] = useState(false);
  const [coverageDetails, setCoverageDetails] = useState<{ planId: string | null; endsAt: string | null }>({
    planId: null,
    endsAt: null,
  });
  const [weatherData, setWeatherData] = useState<any>({ temperature_2m: 25, precipitation: 0, precipitation_probability: 0 });
  const [aiqData, setAiqData] = useState<any>({ us_aqi: 100 });
  const [trafficData, setTrafficData] = useState<any>({ delay_ratio: 1.0, avg_speed: 60, condition: "Light" });
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // New AI/Explainability states
  const [riskResult, setRiskResult] = useState<any>(null);
  const [aiNarrative, setAiNarrative] = useState("");
  const [forecast, setForecast] = useState<any[]>([]);
  const [liveWeatherData, setLiveWeatherData] = useState<any>(null);
  const [liveAqiData, setLiveAqiData] = useState<any>(null);

  const userName = toTitleCase(user?.name || tx(language, "Worker", "वर्कर"));
  const userCity = normalizeCityLabel(user?.city || "Mumbai"); // Default to Mumbai if no city set
  
  // effectiveCity: use actual city names only for lookups
  const effectiveCity = userCity || "";
  
  // displayCity: show to user
  const displayCity = userCity || tx(language, "Your Location", "आपका स्थान");
  
  const policyActive = Boolean(user?.policyActive);
  const personaType = user?.persona_type || "rain";
  const environmentLabel = `Current operating zone (${displayCity})`;
  const deliveryPartner = user?.deliveryPartner || "Zomato";

  const currentCondition = useMemo(() => liveCondition || cityConditions[effectiveCity] || defaultCondition, [effectiveCity, liveCondition]);
  const currentTemp = useMemo(() => parseTemperature(currentCondition.temp), [currentCondition.temp]);
  const rainImpactAssessment = useMemo(
    () => calculateRisk({
      rainProbability: currentCondition.rainProbability,
      aqi: currentCondition.aqi,
      temperature: currentTemp,
    }),
    [currentCondition.aqi, currentCondition.rainProbability, currentTemp],
  );
  const rainImpactPercent = Math.round(rainImpactAssessment.riskScore * 100);
  const rainImpactLevel = rainImpactAssessment.riskLevel;
  const personaProfile = buildDynamicPersonaLabel({
    city: effectiveCity || userCity,
    rainMm: currentCondition.rainMm,
    rainProbability: currentCondition.rainProbability,
    aqi: currentCondition.aqi,
    temperature: currentTemp,
    riskScore: rainImpactAssessment.riskScore,
  });
  const nextSixHoursForecast = useMemo(
    () => generateRiskForecast({
      rainProbability: currentCondition.rainProbability,
      aqi: currentCondition.aqi,
      temperature: currentTemp,
    }),
    [currentCondition.aqi, currentCondition.rainProbability, currentTemp],
  );
  const nextThreeHoursRiskTrend = nextSixHoursForecast.length >= 3
    ? nextSixHoursForecast[2].riskScore > nextSixHoursForecast[0].riskScore
      ? "Increasing ⬆️"
      : nextSixHoursForecast[2].riskScore < nextSixHoursForecast[0].riskScore
        ? "Decreasing ⬇️"
        : "Stable ➖"
    : "Stable ➖";
  const expectedImpactMessage = rainImpactAssessment.riskLevel === "HIGH"
    ? "Heavy rain expected — delivery activity may drop"
    : rainImpactAssessment.riskLevel === "MEDIUM"
      ? "Moderate weather disruption — slight delivery slowdown likely"
      : "Low disruption expected — delivery flow should remain stable";

  const activePlan = useMemo(() => {
    if (!user?.purchasedPlans?.length) return null;
    return planCatalog.find((plan) => plan.id === user.purchasedPlans[0]) || null;
  }, [user]);

  const approvedPayoutsTotal = useMemo(
    () => demoState.transactions
      .filter((tx) => tx.kind === "PAYOUT" && tx.status === "Credited" && !isSimulationOnlyPayout(tx))
      .reduce((sum, tx) => sum + tx.amount, 0),
    [demoState.transactions],
  );

  const resolvedCoveragePlan = useMemo(
    () => (coverageDetails.planId ? planCatalog.find((plan) => plan.id === coverageDetails.planId) || null : activePlan),
    [activePlan, coverageDetails.planId],
  );
  const effectiveWeeklyPremium = resolvedCoveragePlan
    ? parseMoney(resolvedCoveragePlan.premium)
    : demoState.weeklyPremium;

  const coverageDaysRemaining = useMemo(() => {
    if (!coverageDetails.endsAt) return null;
    const remainingMs = new Date(coverageDetails.endsAt).getTime() - Date.now();
    if (!Number.isFinite(remainingMs)) return null;
    return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  }, [coverageDetails.endsAt]);

  const shiftRecommendations = useMemo(
    () => buildRecommendations(trendData, user?.preferences?.aiRecommendationMode || "balanced"),
    [trendData, user?.preferences?.aiRecommendationMode],
  );

  const formattedDate = useMemo(
    () => new Date().toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" }),
    [],
  );

  // Determine recommended plan based on salary
  const getRecommendedPlanBySalary = (salary?: number) => {
    if (!salary) return "day-shield"; // Default to low-risk plan
    if (salary < 40000) return "day-shield"; // Low-tier for lower salaries
    if (salary <= 80000) return "rush-hour-cover"; // Mid-tier for moderate salaries
    return "night-safety"; // Premium plan for higher salaries
  };

  const riskLevel = demoState.riskLevel;
  const salaryRecommendedPlanId = getRecommendedPlanBySalary(user?.salary);
  const recommendedPlanId = riskLevel === "HIGH" ? "night-safety" : riskLevel === "MEDIUM" ? "rush-hour-cover" : "day-shield";
  const realtimeRiskLevel = rainImpactAssessment.riskLevel;
  const earningsEstimate = useMemo(() => estimateEarningsForWorker({
    deliveryPartner,
    city: effectiveCity || userCity,
    riskScore: rainImpactAssessment.riskScore,
    policyActive,
  }), [deliveryPartner, effectiveCity, policyActive, rainImpactAssessment.riskScore, userCity]);
  const canUseTestMode = import.meta.env.DEV;
  const forceTriggerForTesting = canUseTestMode && testModeEnabled;
  const estimatedActivity = clamp(Math.round(100 - currentCondition.rainProbability - currentCondition.rainMm * 0.8), 10, 100);
  const noOrdersFor30Min = forceTriggerForTesting ? true : estimatedActivity < 30;
  const coverageLimit = activePlan ? parseMoney(activePlan.payout) : 800;
  const heavyRainDetected = forceTriggerForTesting ? true : currentCondition.rainMm > 20;
  const floodRiskDetected = forceTriggerForTesting ? true : currentCondition.rainMm > 100;
  const heatwaveDetected = forceTriggerForTesting ? true : currentTemp > 40;
  const pollutionDetected = forceTriggerForTesting ? true : currentCondition.aqi > 300;
  const environmentalTriggers = [
    floodRiskDetected ? "Flood Risk" : null,
    heavyRainDetected ? "Heavy Rain" : null,
    heatwaveDetected ? "Heatwave" : null,
    pollutionDetected ? "Pollution" : null,
  ].filter(Boolean) as string[];
  const triggerReasons = [
    ...environmentalTriggers,
    noOrdersFor30Min ? "Low Activity" : null,
    forceTriggerForTesting ? "Test Mode" : null,
  ].filter(Boolean) as string[];
  const shouldTriggerClaim = policyActive && noOrdersFor30Min && environmentalTriggers.length > 0;
  const claimTriggered = shouldTriggerClaim;
  const autoClaimTriggered = policyActive && (shouldTriggerClaim || claimTriggered);
  const rainTriggerState: "ACTIVE" | "SAFE" = heavyRainDetected ? "ACTIVE" : "SAFE";
  const aqiTriggerState: "ACTIVE" | "SAFE" = pollutionDetected ? "ACTIVE" : "SAFE";
  const zoneTriggerState: "ACTIVE" | "SAFE" = noOrdersFor30Min ? "ACTIVE" : "SAFE";
  const platformTriggerState: "MEDIUM" | "SAFE" = isWeatherLoading ? "MEDIUM" : "SAFE";
  const trafficTriggerState: "ACTIVE" | "MEDIUM" | "SAFE" = rainImpactAssessment.riskScore > 0.75
    ? "ACTIVE"
    : rainImpactAssessment.riskScore > 0.5
      ? "MEDIUM"
      : "SAFE";
  const triggeredBy = triggerReasons.join(" + ") || "No active disruption chain";
  const claimStatus = latestClaim?.status || "pending";
  const claimStatusLabel = claimStatus === "approved" ? "Approved" : claimStatus === "rejected" ? "Rejected" : "Pending";
  const projectedPayout = coverageLimit;
  const claimAmount = Number(latestClaim?.amount || projectedPayout);
  const claimTriggersLabel = latestClaim?.triggers?.length ? latestClaim.triggers.join(" + ") : triggeredBy;
  const claimVisualState: "idle" | "triggered" | "processing" | "credited" | "rejected" = claimStatus === "approved"
    ? "credited"
    : claimStatus === "rejected"
      ? "rejected"
      : latestClaim
        ? "processing"
        : autoClaimTriggered
          ? "triggered"
          : "idle";
  const liveStatusMessage = claimVisualState === "credited"
    ? `✅ ₹${claimAmount} credited successfully`
    : claimVisualState === "processing"
      ? "⚡ Disruption detected → Claim processing..."
      : "No disruption detected";

  const triggerAutoPayoutTest = () => {
    if (!canUseTestMode) return;
    if (!policyActive || !activePlan) {
      toast.warning("Activate a weekly plan first to test auto payout.");
      return;
    }

    setFraudFlags([]);
    setClaimBlocked(false);
    setTestModeEnabled(true);
    setTestTriggerNonce(Date.now());
    toast.info("Test mode armed. Auto payout trigger is being simulated now.");
  };

  const walletImpactLines = useMemo(() => {
    const entries = demoState.transactions
      .filter((tx) => !isSimulationOnlyPayout(tx))
      .slice(0, 3)
      .map((tx) => {
      const sign = tx.kind === "PAYOUT" ? "+" : "-";
      const label = tx.kind === "PAYOUT"
        ? `${tx.eventType || "Risk"} Payout`
        : "Insurance Premium";
      return { text: `${sign} ₹${tx.amount} ${label}`, positive: tx.kind === "PAYOUT" };
      });

    if (entries.length >= 3) return entries;

    return [
      { text: "+ ₹800 Rain Payout", positive: true },
      { text: "+ ₹1200 AQI Payout", positive: true },
      { text: "- ₹49 Insurance Premium", positive: false },
    ];
  }, [demoState.transactions]);

  const payoutHistory = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: d.toLocaleDateString("en-IN", { month: "short" }),
        amount: 0,
      };
    });

    const map = new Map(months.map((item) => [item.key, item]));
    demoState.transactions
      .filter((tx) => tx.kind === "PAYOUT" && tx.status === "Credited")
      .forEach((tx) => {
        const date = new Date(tx.createdAt);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const month = map.get(key);
        if (month) month.amount += tx.amount;
      });

    return months;
  }, [demoState.transactions]);

  const claimFreeThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return !demoState.transactions.some((tx) => {
      if (tx.kind !== "PAYOUT" || tx.status !== "Credited" || isSimulationOnlyPayout(tx)) return false;
      return new Date(tx.createdAt).getTime() >= weekAgo;
    });
  }, [demoState.transactions]);

  const totalPayouts = useMemo(
    () => demoState.transactions
      .filter((tx) => tx.kind === "PAYOUT" && tx.status === "Credited" && !isSimulationOnlyPayout(tx))
      .reduce((sum, tx) => sum + tx.amount, 0),
    [demoState.transactions],
  );

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const refreshClaim = async (nextWorkerId?: number | null) => {
    const resolvedWorkerId = nextWorkerId ?? workerId;
    if (!resolvedWorkerId) return;

    const { claim } = await fetchLatestClaimByUserId(resolvedWorkerId);
    setLatestClaim(claim);
  };

  const runFraudCheck = async (): Promise<"APPROVE" | "REVIEW" | "BLOCK"> => {
    if (forceTriggerForTesting) {
      setFraudFlags([]);
      setClaimBlocked(false);
      return "APPROVE";
    }

    try {
      const res = await fetch("/api/fraud/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_email: user?.email,
          city: userCity,
          rain_mm: currentCondition.rainMm,
          aqi: currentCondition.aqi,
          triggers: triggerReasons,
        }),
      });
      const data = await res.json();
      setFraudFlags(data.flags || []);
      setClaimBlocked(data.isFraudulent);
      return data.recommendation || "APPROVE";
    } catch {
      return "APPROVE";
    }
  };

  const startPlanPayment = (planId: string) => {
    setPaymentPlanId(planId);
    setUpiId("");
    setPaymentStatus("");
    setIsProcessing(false);
  };

  const activatePlan = async (planId: string) => {
    if (!user) return;
    const plan = planCatalog.find((item) => item.id === planId);
    if (!plan) return;

    const expected = parseMoney(plan.premium);

    const next = {
      ...user,
      policyActive: true,
      purchasedPlans: [planId, ...(user.purchasedPlans || []).filter((item) => item !== planId)],
    };
    setSession(next);
    setUser(next);
    setCoverageDetails({
      planId,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setPaymentPlanId(null);
    setUpiId("");
    setIsProcessing(false);

    const updatedDemo = recordPremiumPayment(next, expected, plan.name);
    updatedDemo.weeklyPremium = expected;
    setDemoState(updatedDemo);

    try {
      await syncInsurancePolicyToDb({
        worker_email: next.email,
        plan_id: planId,
        weekly_premium: expected,
        risk_level: riskLevel,
        coverage_amount: parseMoney(plan.payout),
        status: "active",
      });
    } catch {
      // UI state remains source-of-truth for demo flow if DB sync temporarily fails.
    }

    toast.success(tx(language, "Insurance activated. You can now simulate disruption events.", "इंश्योरेंस एक्टिव हो गया। अब आप डिसरप्शन इवेंट सिमुलेट कर सकते हैं।"));
  };

  const initiateRazorpay = async (planId: string, amount: number) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      setPaymentStatus(tx(language, "Processing payment...", "पेमेंट प्रोसेस हो रही है..."));

      // Validate amount
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Invalid amount: ₹${amount}`);
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Razorpay SDK failed to load. Please refresh and try again.");
      }

      // Create payment order with proper error logging
      console.log(`[Payment] Creating order for amount: ₹${amount}`);
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Payment] Order creation failed (${res.status}):`, errorText);
        throw new Error(`Order creation failed: ${res.status} ${errorText || "Unknown error"}`);
      }

      const order = await res.json();
      console.log("[Payment] Order created:", order.id);

      if (!order?.id) {
        throw new Error("Invalid order response from server");
      }

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log("[Payment] Razorpay Key ID:", keyId ? "configured" : "MISSING!");

      if (!keyId) {
        throw new Error("Razorpay Key ID not configured in environment (.env file)");
      }

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: keyId,
          amount: order.amount,
          currency: order.currency,
          name: "SmartShift Insurance",
          description: tx(language, "Policy Purchase", "पॉलिसी खरीद"),
          order_id: order.id,
          handler: async (response: RazorpayHandlerResponse) => {
            try {
              console.log("[Payment] Handler response received:", response.razorpay_payment_id);
              const verifyRes = await fetch("/api/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });

              const verifyResult = await verifyRes.json();
              if (!verifyRes.ok || !verifyResult.verified) {
                console.error("[Payment] Verification failed:", verifyResult);
                throw new Error("Payment verification failed");
              }

              console.log("[Payment] Verification successful!");
              setPaymentStatus(tx(language, "✅ Payment Successful", "✅ पेमेंट सफल"));
              await activatePlan(planId);
              resolve();
            } catch (error) {
              console.error("[Payment] Handler error:", error);
              setPaymentStatus(tx(language, "Payment verification failed", "पेमेंट वेरिफिकेशन असफल"));
              toast.warning(tx(language, "Payment verification failed.", "पेमेंट वेरिफिकेशन असफल रहा।"));
              reject(new Error("Verification failed"));
            }
          },
          prefill: {
            email: user.email,
            contact: user.phone || "",
            name: user.name,
          },
          notes: {
            plan_id: planId,
            worker_email: user.email,
            upi_id: upiId,
          },
          theme: {
            color: "#2563eb",
          },
          modal: {
            ondismiss: () => {
              console.log("[Payment] Razorpay modal dismissed");
              setIsProcessing(false);
              setPaymentStatus(tx(language, "Payment cancelled", "पेमेंट रद्द की गई"));
            },
          },
        };

        console.log("[Payment] Opening Razorpay modal with options:", { amount: order.amount, orderId: order.id });
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (error: any) => {
          console.error("[Payment] Payment failed:", error);
          setIsProcessing(false);
          const errorMsg = error?.error?.description || "Payment failed";
          setPaymentStatus(tx(language, `❌ ${errorMsg}`, `❌ ${errorMsg}`));
          toast.error(tx(language, errorMsg, errorMsg));
          reject(new Error(errorMsg));
        });
        rzp.open();
      });
    } catch (error) {
      setIsProcessing(false);
      const errorMsg = (error as Error).message || "Unable to process payment";
      console.error("[Payment] Error:", errorMsg);
      setPaymentStatus(tx(language, `❌ ${errorMsg}`, `❌ ${errorMsg}`));
      toast.error(tx(language, errorMsg, errorMsg));
    }
  };

  const handlePurchase = (planId: string) => {
    const plan = planCatalog.find((item) => item.id === planId);
    if (!plan) return;
    // No UPI validation needed - let Razorpay handle payment with all options
    void initiateRazorpay(planId, parseMoney(plan.premium));
  };

  useEffect(() => {
    if (!user) return;
    setDemoState(getWorkerDemoState(user));
  }, [user?.email, user?._sessionToken]);

  useEffect(() => {
    const syncSessionUser = () => {
      setUser(getSession());
    };

    window.addEventListener("storage", syncSessionUser);
    window.addEventListener(SESSION_UPDATED_EVENT, syncSessionUser);

    return () => {
      window.removeEventListener("storage", syncSessionUser);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncSessionUser);
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;

    void fetchWorkerPortalState(user.email)
      .then(async (portal) => {
        if (cancelled) return;

        const activePolicy = portal.activePolicy;
        const policyPlanId = inferPlanIdFromPolicy(activePolicy);
        const policyIsActive = Boolean(activePolicy && String(activePolicy.status).toLowerCase() === "active");

        let profilePlanId: string | null = normalizePlanId(portal.worker?.active_plan || null);
        let profilePlanIsActive = Boolean(
          portal.worker?.active_plan
          && portal.worker?.plan_end_time
          && new Date(portal.worker.plan_end_time).getTime() > Date.now(),
        );
        let resolvedCoverageEndsAt: string | null = portal.worker?.plan_end_time || null;

        if (!profilePlanId || !profilePlanIsActive) {
          try {
            const profile = await fetchUserProfile(user.email);
            profilePlanId = normalizePlanId(profile.active_plan);
            profilePlanIsActive = Boolean(
              profile.active_plan
              && profile.plan_end_time
              && new Date(profile.plan_end_time).getTime() > Date.now(),
            );
            if (profilePlanIsActive) {
              resolvedCoverageEndsAt = profile.plan_end_time;
            }
          } catch {
            // Non-blocking profile hydration fallback.
          }
        }

        const activePlanId = profilePlanId || policyPlanId;
        const policyIsCurrentlyActive = profilePlanIsActive || policyIsActive;
        const resolvedWorkerId = Number(portal.worker?.id || 0) || null;
        setWorkerId(resolvedWorkerId);
        setCoverageDetails({
          planId: activePlanId,
          endsAt: resolvedCoverageEndsAt,
        });

        if (portal.latestClaim) {
          setLatestClaim({
            id: Number(portal.latestClaim.id),
            userId: Number(portal.latestClaim.worker_id),
            triggers: Array.isArray(portal.latestClaim.triggers) ? portal.latestClaim.triggers : [],
            status: normalizeClaimLifecycleStatus(portal.latestClaim.status),
            amount: Number(portal.latestClaim.payout_amount || 0),
            createdAt: String(portal.latestClaim.created_at),
          });
        } else {
          setLatestClaim(null);
        }

        setUser((previous) => {
          if (!previous) return previous;

          const nextPurchasedPlans = activePlanId
            ? [activePlanId, ...(previous.purchasedPlans || []).filter((item) => item !== activePlanId)]
            : previous.purchasedPlans;

          const next = {
            ...previous,
            name: portal.worker?.name || previous.name,
            city: portal.worker?.city || previous.city,
            persona_type: portal.worker?.persona_type || previous.persona_type,
            deliveryPartner: portal.worker?.delivery_partner || previous.deliveryPartner,
            policyActive: policyIsCurrentlyActive,
            purchasedPlans: nextPurchasedPlans,
          };

          const changed =
            next.name !== previous.name ||
            next.city !== previous.city ||
            next.persona_type !== previous.persona_type ||
            next.deliveryPartner !== previous.deliveryPartner ||
            next.policyActive !== previous.policyActive ||
            JSON.stringify(next.purchasedPlans) !== JSON.stringify(previous.purchasedPlans);

          if (!changed) return previous;
          setSession(next);
          return next;
        });

        setDemoState((current) => {
          const mappedLastEventStatus: "Credited" | "Rejected" = String(portal.latestClaim?.status).toLowerCase() === "approved"
            ? "Credited"
            : "Rejected";

          const next = {
            ...current,
            walletBalance: Number(portal.walletBalance ?? current.walletBalance),
            claimReviewStatus: portal.latestClaim
              ? (String(portal.latestClaim.status).toLowerCase() === "approved"
                ? "Approved"
                : String(portal.latestClaim.status).toLowerCase() === "rejected"
                  ? "Rejected"
                  : "Pending Approval")
              : current.claimReviewStatus,
            claimReviewReason: portal.latestClaim?.review_reason || current.claimReviewReason,
            lastEvent: portal.latestClaim
              ? ({
                eventType: "Rain" as const,
                amount: Number(portal.latestClaim.payout_amount || 0),
                status: mappedLastEventStatus,
                timestamp: portal.latestClaim.created_at,
              } as typeof current.lastEvent)
              : current.lastEvent,
          };

          if (user) {
            saveWorkerDemoState(user, next);
          }

          return next;
        });
      })
      .catch(() => {
        // Keep dashboard usable with existing local session state if fetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;

    saveRegisteredWorkerProfile({
      name: user.name,
      email: user.email,
      city: user.city,
      persona_type: user.persona_type,
      deliveryPartner: user.deliveryPartner,
    });

    const syncFromStore = () => {
      setDemoState(getWorkerDemoState(user));
    };

    syncFromStore();
    const intervalId = window.setInterval(syncFromStore, 2000);
    window.addEventListener("storage", syncFromStore);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncFromStore);
    };
  }, [user?.city, user?.deliveryPartner, user?.email, user?.name, user?.persona_type]);

  // Fetch weather and environment data for user's city
  useEffect(() => {
    if (!userCity || !user?.email) {
      // Set default values if no city
      setWeatherData({ temperature_2m: 25, precipitation: 0, precipitation_probability: 0 });
      setAiqData({ us_aqi: 100 });
      setTrafficData({ delay_ratio: 1.0, avg_speed: 60, condition: "Light" });
      setLoadingWeather(false);
      return;
    }

    let cancelled = false;
    setLoadingWeather(true);

    // Timeout failsafe — ensure loading state clears after 5 seconds
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.warn("⏱️ Weather fetch timeout — using fallback data");
        setWeatherData({ temperature_2m: 25, precipitation: 0, precipitation_probability: 0 });
        setAiqData({ us_aqi: 100 });
        setTrafficData({ delay_ratio: 1.0, avg_speed: 60, condition: "Light" });
        setLoadingWeather(false);
      }
    }, 5000);

    const fetchWeatherData = async () => {
      try {
        console.log("🌤 Fetching weather for city:", userCity);
        
        // Use backend API which handles all weather data
        const res = await fetch("/api/ai/risk/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: userCity,
            workerEmail: user.email,
          }),
        });

        if (cancelled) return;

        if (!res.ok) {
          console.error("Weather API error:", res.status);
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        console.log("✅ Weather data received:", data);
        
        const current = data?.current;
        
        if (current) {
          // Extract weather from backend response
          setWeatherData({
            temperature_2m: current.temperature || 25,
            precipitation: current.rainMm || 0,
            precipitation_probability: current.rainProbability || 0,
          });

          // Extract AQI
          setAiqData({
            us_aqi: current.aqi || 100,
          });
        }

        // Set traffic data from backend
        if (data?.signals) {
          setTrafficData({
            delay_ratio: data.signals.trafficDelayRatio || 1.0,
            avg_speed: Math.round(60 / (data.signals.trafficDelayRatio || 1.0)),
            condition: (data.signals.trafficDelayRatio || 1.0) > 1.3 ? "Heavy" : (data.signals.trafficDelayRatio || 1.0) > 1.1 ? "Moderate" : "Light",
          });
        }
      } catch (error) {
        console.error("❌ Weather fetch error:", error);
        // Use fallback data
        setWeatherData({ temperature_2m: 25, precipitation: 0, precipitation_probability: 0 });
        setAiqData({ us_aqi: 100 });
        setTrafficData({ delay_ratio: 1.0, avg_speed: 60, condition: "Light" });
      } finally {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setLoadingWeather(false);
        }
      }
    };

    fetchWeatherData();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [userCity, user?.email]);

  // Calculate AI risk model and get Claude narrative
  useEffect(() => {
    if (!userCity || !weatherData || !aiqData) return;

    const calculateAiRisk = async () => {
      try {
        // Create risk factors from current data
        const factors: RiskFactors = {
          rainMm: weatherData.precipitation || 0,
          aqiIndex: aiqData.us_aqi || 100,
          tempCelsius: weatherData.temperature_2m || 25,
          trafficDelayPercent: (trafficData.delay_ratio || 1.0) * 30,
          hour: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
        };

        // Run risk engine
        const result = calculateRiskEngine(factors);
        setRiskResult(result);

        // Get Claude AI narrative (non-blocking, can fail gracefully)
        const narrative = await getAIRiskNarrative(
          factors,
          result,
          userCity,
          deliveryPartner || "Zomato"
        );
        setAiNarrative(narrative);
      } catch (error) {
        console.error("AI risk calculation error:", error);
      }
    };

    calculateAiRisk();
  }, [weatherData, aiqData, trafficData, userCity, deliveryPartner]);

  // Fetch hourly forecast for earnings optimization
  useEffect(() => {
    if (!userCity) return;

    const loadForecast = async () => {
      try {
        const hourlyData = await fetchHourlyForecast(userCity);
        setForecast(hourlyData);
      } catch (error) {
        console.error("Forecast load error:", error);
        setForecast([]);
      }
    };

    loadForecast();
  }, [userCity]);

  useEffect(() => {
    if (!user) return;
    const derived = calculateRisk({
      rainProbability: currentCondition.rainProbability,
      aqi: currentCondition.aqi,
      temperature: currentTemp,
    });
    const premium = calculateWeeklyPremiumBreakdown({
      riskScore: derived.riskScore,
      rainProbability: currentCondition.rainProbability,
      aqi: currentCondition.aqi,
      claimFreeThisWeek,
    }).finalPremium;
    const nextPremium = user.policyActive ? demoState.weeklyPremium : premium;
    if (derived.riskLevel !== demoState.riskLevel || nextPremium !== demoState.weeklyPremium) {
      const next = { ...demoState, riskLevel: derived.riskLevel, weeklyPremium: nextPremium };
      setDemoState(next);
      saveWorkerDemoState(user, next);
    }
  }, [claimFreeThisWeek, currentCondition.aqi, currentCondition.rainProbability, currentTemp, demoState, user]);

  useEffect(() => {
    if (!user?.policyActive || !resolvedCoveragePlan) return;
    const planPremium = parseMoney(resolvedCoveragePlan.premium);

    setDemoState((current) => {
      if (current.weeklyPremium === planPremium) return current;
      const next = { ...current, weeklyPremium: planPremium };
      saveWorkerDemoState(user, next);
      return next;
    });
  }, [resolvedCoveragePlan?.id, user?.email, user?.policyActive]);

  useEffect(() => {
    if (!payoutCelebration) return;
    const timeoutId = window.setTimeout(() => setPayoutCelebration(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [payoutCelebration]);

  useEffect(() => {
    if (!user || !workerId || !policyActive || !activePlan || !autoClaimTriggered) return;

    const claimWindow = new Date().toISOString().slice(0, 13);
    const claimKey = forceTriggerForTesting
      ? `AUTO-TEST-${activePlan.id}-${testTriggerNonce}-${triggeredBy}`
      : `AUTO-${activePlan.id}-${claimWindow}-${triggeredBy}`;
    if (claimKey === lastAutoClaimKey) return;

    setLastAutoClaimKey(claimKey);
    void (async () => {
      if (forceTriggerForTesting) {
        const now = new Date().toISOString();
        const simulatedAmount = coverageLimit;

        setLatestClaim({
          id: -Date.now(),
          userId: workerId,
          triggers: triggerReasons,
          status: "approved",
          amount: simulatedAmount,
          createdAt: now,
        });

        setDemoState((current) => {
          const next = {
            ...current,
            lastEvent: {
              eventType: "Rain" as const,
              amount: simulatedAmount,
              status: "Credited" as const,
              timestamp: now,
            },
            transactions: [
              {
                id: `SIM-PAYOUT-${Date.now()}`,
                kind: "PAYOUT" as const,
                amount: simulatedAmount,
                status: "Credited" as const,
                label: "Test auto payout simulated (wallet not credited)",
                eventType: "Rain" as const,
                createdAt: now,
              },
              ...current.transactions,
            ].slice(0, 20),
          };
          saveWorkerDemoState(user, next);
          return next;
        });

        setTestModeEnabled(false);
        toast.success(`Test payout simulated: ₹${simulatedAmount} (wallet unchanged)`);
        return;
      }

      const recommendation = await runFraudCheck();

      if (recommendation === "BLOCK") {
        if (forceTriggerForTesting) {
          setTestModeEnabled(false);
        }
        toast.error("⚠️ Claim blocked — suspicious activity detected");
        return;
      }

      if (recommendation === "REVIEW") {
        toast.warning("⚠️ Claim flagged for review — will be processed manually");
      }

      const payout = coverageLimit;

      try {
        const response = await createClaimLifecycle({
          userId: workerId,
          triggers: triggerReasons,
          amount: payout,
        });
        setLatestClaim(response.claim);
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const approved = await approveClaimLifecycle(response.claim.id);
        setLatestClaim(approved.claim);
        setPayoutCelebration({ amount: approved.claim.amount, walletBalance: approved.walletBalance });
        if (forceTriggerForTesting) {
          setTestModeEnabled(false);
        }

        const portal = await fetchWorkerPortalState(user.email);
        setDemoState((current) => {
          const next = {
            ...current,
            walletBalance: Number(portal.walletBalance ?? current.walletBalance),
          };
          saveWorkerDemoState(user, next);
          return next;
        });

        toast.success(`💸 ₹${approved.claim.amount} credited due to detected disruption`);
      } catch {
        if (forceTriggerForTesting) {
          setTestModeEnabled(false);
        }
        toast.error("Unable to create claim right now");
      }
    })();
  }, [activePlan, autoClaimTriggered, coverageLimit, forceTriggerForTesting, lastAutoClaimKey, policyActive, testTriggerNonce, triggerReasons, triggeredBy, user, workerId]);

  useEffect(() => {
    if (!user?.email) return;

    void syncWorkerToDb({
      name: user.name,
      email: user.email,
      city: user.city,
      persona_type: user.persona_type,
      delivery_partner: user.deliveryPartner,
    }).catch(() => {
      // Non-blocking worker sync.
    });
  }, [user?.city, user?.deliveryPartner, user?.email, user?.name, user?.persona_type]);

  // Load risk assessment and trend data based on profile city
  useEffect(() => {
    let cancelled = false;

    const loadRiskData = async () => {
      if (!userCity) {
        setLiveCondition(null);
        setTrendData(fallbackTrend);
        return;
      }

      setIsWeatherLoading(true);

      try {
        const ai = await fetchAiRiskAssessment({
          city: userCity,
          workerEmail: user?.email,
        });

        const temp = Number(ai.current.temperature ?? 0);
        const rain = Number(ai.current.rainMm ?? 0);
        const currentAqi = Number(ai.current.aqi ?? cityConditions[userCity]?.aqi ?? 100);
        const rainProbability = Number(ai.current.rainProbability ?? 0);
        const riskResult = {
          riskScore: Number(ai.current.risk.riskScore ?? 0),
          riskLevel: ai.current.risk.riskLevel,
        };
        const risk = riskResult.riskScore;

        const nextTrend: TrendPoint[] = (ai.trend || [])
          .map((point) => ({
            time: point.label || toLabel(point.hour),
            score: Number(Number(point.riskScore || 0).toFixed(2)),
            hour: Number(point.hour || 0),
          }))
          .filter((point) => point.hour >= 6 && point.hour <= 20 && point.hour % 2 === 0);

        if (!cancelled) {
          // Log risk data to database
          void syncRiskDataToDb({
            city: userCity,
            rain_probability: Math.round(rainProbability),
            aqi: Math.round(currentAqi),
            temperature: Math.round(temp),
            risk_score: Number(risk.toFixed(2)),
            risk_level: riskResult.riskLevel,
          }).catch(() => {
            // Non-blocking risk logging
          });

          setLiveCondition({
            rain: getRainLabel(rain),
            rainMm: Number(rain.toFixed(1)),
            rainProbability: Math.round(rainProbability),
            aqi: Math.round(currentAqi),
            temp: `${Math.round(temp)}°C`,
            risk: Number(risk.toFixed(2)),
          });

          if (nextTrend.length >= 4) {
            setTrendData(nextTrend);
          } else {
            setTrendData(fallbackTrend);
          }
        }
      } catch {
        if (!cancelled) {
          setLiveCondition(null);
          setTrendData(fallbackTrend);
        }
      } finally {
        if (!cancelled) {
          setIsWeatherLoading(false);
        }
      }
    };

    loadRiskData();
    const intervalId = window.setInterval(loadRiskData, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userCity, user?.email, user?.preferences?.aiRecommendationMode]);

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo%202.png" alt="SmartShift logo" className="h-11 w-11 object-contain drop-shadow-sm" />
              <span className="font-display font-bold text-foreground">SmartShift</span>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">{tx(language, "Worker Dashboard", "वर्कर डैशबोर्ड")}</span>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors" aria-label="Open profile menu">
                  <User className="w-4 h-4 text-primary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {activePlan && (
                  <>
                    <DropdownMenuItem className="gap-2">
                      <Receipt className="h-4 w-4" /> {tx(language, "Plan", "प्लान")}: {tx(language, activePlan.name, planNameHindi[activePlan.name] || activePlan.name)}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 w-full">
                    <CircleUserRound className="h-4 w-4" /> {tx(language, "Profile", "प्रोफाइल")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4" /> {tx(language, "Settings", "सेटिंग्स")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-risk-high" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> {tx(language, "Logout", "लॉगआउट")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {claimBlocked && (
        <div className="bg-red-900/80 border border-red-500/50 text-red-200 px-4 py-3 mx-4 mt-4 rounded-xl">
          <p className="font-semibold text-sm">⚠️ Suspicious Claim Detected — Claim Blocked</p>
          {fraudFlags.map((flag) => (
            <p key={flag.type} className="text-xs mt-1 text-red-300">
              • [{flag.severity}] {flag.message}
            </p>
          ))}
        </div>
      )}

      {fraudFlags.length > 0 && !claimBlocked && (
        <div className="bg-amber-900/80 border border-amber-500/50 text-amber-200 px-4 py-3 mx-4 mt-4 rounded-xl">
          <p className="font-semibold text-sm">⚠️ Claim Flagged for Manual Review</p>
          {fraudFlags.map((flag) => (
            <p key={flag.type} className="text-xs mt-1 text-amber-300">
              • [{flag.severity}] {flag.message}
            </p>
          ))}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 space-y-7">
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{tx(language, "Welcome back", "वापसी पर स्वागत है")}, {userName} 👋</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-2">
              <MapPin className="w-3.5 h-3.5" /> {displayCity} | {formattedDate}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              📍 Working in: <span className="text-blue-400 font-semibold">{userCity}</span> {loadingWeather ? "📡 Loading weather..." : "✅ Weather updated"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Delivery Partner: {deliveryPartner}</p>
            {user?.salary && <p className="text-sm text-muted-foreground mt-1">Monthly Salary: ₹{Number(user.salary).toLocaleString('en-IN')}</p>}
            <p className="text-sm text-muted-foreground mt-1">{tx(language, `💰 Daily Earnings: ${earningsEstimate.dailyLow}–${earningsEstimate.dailyHigh}`, `💰 दैनिक कमाई: ${earningsEstimate.dailyLow}–${earningsEstimate.dailyHigh}`)}</p>
            <p className="text-sm text-muted-foreground mt-1">{tx(language, `📅 Weekly Earnings: ${earningsEstimate.weeklyLow}–${earningsEstimate.weeklyHigh}`, `📅 साप्ताहिक कमाई: ${earningsEstimate.weeklyLow}–${earningsEstimate.weeklyHigh}`)}</p>
            <p className="text-sm text-foreground mt-2 font-medium">Your Profile: {personaProfile}</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5" /> Your Work Environment: {environmentLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {policyActive ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                <span className="text-sm font-medium text-accent">{tx(language, "Policy Active", "पॉलिसी सक्रिय")}</span>
                <span className="text-xs text-muted-foreground">· {activePlan?.window || tx(language, "Coverage running", "कवरेज चालू")}</span>
              </div>
            ) : (
              <div className="text-xs md:text-sm px-3 py-2 rounded-lg bg-muted/50 border border-border/60 text-muted-foreground">
                {tx(language, "Choose a plan, enter payment amount, and activate instantly", "प्लान चुनें, पेमेंट राशि दर्ज करें और तुरंत एक्टिव करें")}
              </div>
            )}
          </div>
        </motion.div>

        <div className="space-y-8">
          <section className="space-y-4 pt-2">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground tracking-tight">🔥 Your Coverage</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl p-5 border border-emerald-400/30 bg-emerald-950/40 shadow-[0_0_18px_rgba(34,197,94,0.12)]">
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">Earnings Protected</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">₹{approvedPayoutsTotal}</p>
                <p className="text-xs text-emerald-100/70 mt-1">Sum of all approved payouts</p>
              </div>

              <div className="rounded-2xl p-5 border border-blue-400/30 bg-blue-950/40 shadow-[0_0_18px_rgba(59,130,246,0.12)]">
                <p className="text-xs uppercase tracking-wide text-blue-200/80">Weekly Coverage</p>
                <p className="mt-2 text-lg font-semibold text-blue-100">
                  {resolvedCoveragePlan
                    ? tx(language, resolvedCoveragePlan.name, planNameHindi[resolvedCoveragePlan.name] || resolvedCoveragePlan.name)
                    : tx(language, "No active coverage", "कोई सक्रिय कवरेज नहीं")}
                </p>
                <p className="text-xs text-blue-100/70 mt-1">
                  {coverageDaysRemaining !== null
                    ? `${coverageDaysRemaining} day${coverageDaysRemaining === 1 ? "" : "s"} remaining`
                    : tx(language, "Days remaining unavailable", "बचे हुए दिन उपलब्ध नहीं हैं")}
                </p>
              </div>

              <div className="rounded-2xl p-5 border border-amber-400/30 bg-amber-950/40 shadow-[0_0_18px_rgba(245,158,11,0.12)]">
                <p className="text-xs uppercase tracking-wide text-amber-200/80">This Week's Risk Level</p>
                <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide border border-current/20 bg-black/20">
                  <span className={rainImpactLevel === "HIGH" ? "text-red-300" : rainImpactLevel === "MEDIUM" ? "text-amber-300" : "text-emerald-300"}>
                    {rainImpactLevel}
                  </span>
                </div>
                <p className="text-xs text-amber-100/70 mt-2">Based on current live risk conditions</p>
              </div>
            </div>

            {/* Weather, AQI, and Traffic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Weather Card */}
              <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="rounded-2xl p-6 border border-blue-400/30 bg-blue-950/40 shadow-[0_0_18px_rgba(59,130,246,0.12)] hover:shadow-[0_0_28px_rgba(59,130,246,0.18)] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-blue-200/80">🌤 Weather</p>
                    <p className="text-2xl font-bold text-blue-300 mt-2">{weatherData?.temperature_2m ? `${Math.round(weatherData.temperature_2m)}°C` : "N/A"}</p>
                    <p className="text-xs text-blue-100/70 mt-1">{weatherData?.precipitation ? `${weatherData.precipitation}mm rain` : "No rain"}</p>
                    <p className="text-xs text-blue-100/70 mt-0.5">{weatherData?.precipitation_probability ? `${weatherData.precipitation_probability}% chance` : "Clear skies"}</p>
                  </div>
                  <div className="text-4xl">{weatherData?.precipitation && weatherData.precipitation > 0 ? "🌧" : "☀️"}</div>
                </div>
              </motion.div>

              {/* AQI Card */}
              <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible" className="rounded-2xl p-6 border border-purple-400/30 bg-purple-950/40 shadow-[0_0_18px_rgba(168,85,247,0.12)] hover:shadow-[0_0_28px_rgba(168,85,247,0.18)] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-purple-200/80">💨 Air Quality</p>
                    <p className="text-2xl font-bold text-purple-300 mt-2">{aiqData?.us_aqi ? Math.round(aiqData.us_aqi) : "N/A"}</p>
                    <p className="text-xs text-purple-100/70 mt-1">
                      {aiqData?.us_aqi ? (
                        aiqData.us_aqi > 300 ? "Hazardous 🔴" : 
                        aiqData.us_aqi > 200 ? "Very Unhealthy 🟠" :
                        aiqData.us_aqi > 150 ? "Unhealthy 🟡" :
                        aiqData.us_aqi > 100 ? "Moderate ⚪" :
                        "Good 🟢"
                      ) : "N/A"}
                    </p>
                    <p className="text-xs text-purple-100/70 mt-0.5">AQI Index</p>
                  </div>
                  <div className="text-4xl">
                    {aiqData?.us_aqi ? (
                      aiqData.us_aqi > 300 ? "🚨" :
                      aiqData.us_aqi > 150 ? "⚠️" :
                      "✅"
                    ) : "❓"}
                  </div>
                </div>
              </motion.div>

              {/* Traffic Card */}
              <motion.div variants={fadeUp} custom={2} initial="hidden" animate="visible" className="rounded-2xl p-6 border border-orange-400/30 bg-orange-950/40 shadow-[0_0_18px_rgba(234,88,12,0.12)] hover:shadow-[0_0_28px_rgba(234,88,12,0.18)] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-orange-200/80">🚗 Traffic</p>
                    <p className="text-2xl font-bold text-orange-300 mt-2">{trafficData?.condition || "Moderate"}</p>
                    <p className="text-xs text-orange-100/70 mt-1">{trafficData?.avg_speed ? `${trafficData.avg_speed} km/h avg` : "Normal flow"}</p>
                    <p className="text-xs text-orange-100/70 mt-0.5">{trafficData?.delay_ratio ? `${(trafficData.delay_ratio * 100).toFixed(0)}% delay` : "No delay"}</p>
                  </div>
                  <div className="text-4xl">
                    {trafficData?.condition === "Heavy" ? "🔴" :
                     trafficData?.condition === "Moderate" ? "🟡" : "🟢"}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="rounded-2xl p-6 border border-emerald-400/35 bg-[rgba(16,32,24,0.72)] shadow-[0_0_20px_rgba(34,197,94,0.14)]">
                <p className="text-xs font-medium text-muted-foreground">Core Impact</p>
                <h3 className="text-3xl md:text-[2rem] font-bold text-emerald-300 mt-1">💰 Wallet: ₹{demoState.walletBalance}</h3>
                <div className="mt-3 space-y-1.5">
                  {walletImpactLines.slice(0, 3).map((line) => (
                    <p key={line.text} className={`text-sm ${line.positive ? "text-emerald-400" : "text-red-400"}`}>{line.text}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6 border border-primary/25 bg-[#111827] shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <h3 className="font-display font-semibold text-foreground mb-3">Active Policy</h3>
                {policyActive && activePlan ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="text-foreground font-medium">{tx(language, activePlan.name, planNameHindi[activePlan.name] || activePlan.name)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Coverage</span><span className="text-foreground font-medium">{activePlan.window}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Weekly Premium</span><span className="text-foreground font-semibold">₹{effectiveWeeklyPremium}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-accent font-medium">Monitoring ✅</span></div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 p-4 bg-muted/20">
                    <p className="text-sm text-muted-foreground">No active policy. Choose a plan to activate coverage.</p>
                  </div>
                )}
              </div>

              <div className={`rounded-2xl p-6 border shadow-[0_0_20px_rgba(59,130,246,0.1)] ${claimVisualState === "credited" ? "border-emerald-400/40 bg-[rgba(16,32,24,0.9)] shadow-[0_0_28px_rgba(34,197,94,0.18)]" : claimVisualState === "processing" ? "border-amber-300/35 bg-[rgba(35,26,7,0.88)] shadow-[0_0_28px_rgba(250,204,21,0.16)]" : claimVisualState === "triggered" || claimVisualState === "rejected" ? "border-red-400/35 bg-[rgba(49,16,16,0.88)] shadow-[0_0_28px_rgba(248,113,113,0.14)]" : "border-primary/25 bg-[#111827]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">⚡ Zero-Touch Claim Activated</h3>
                    <p className="text-xs text-muted-foreground mt-1">Live Status: {liveStatusMessage}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border/60 bg-black/15 p-4 text-sm space-y-2">
                  <p><span className="text-muted-foreground">🌧 Rain Trigger (&gt;20 mm/hr):</span> <span className={`font-semibold ${currentCondition.rainMm > 20 ? "text-red-300" : "text-foreground"}`}>{currentCondition.rainMm > 20 ? "ACTIVE" : "SAFE"}</span></p>
                  <p><span className="text-muted-foreground">🌊 Flood Trigger (&gt;100 mm/day):</span> <span className={`font-semibold ${currentCondition.rainMm > 100 ? "text-red-300" : "text-foreground"}`}>{currentCondition.rainMm > 100 ? "ACTIVE" : "SAFE"}</span></p>
                  <p><span className="text-muted-foreground">🌡 Heatwave Trigger (&gt;40°C):</span> <span className={`font-semibold ${currentTemp > 40 ? "text-red-300" : "text-foreground"}`}>{currentTemp > 40 ? "ACTIVE" : "SAFE"}</span></p>
                  <p><span className="text-muted-foreground">🌫 Pollution Trigger (AQI &gt; 300):</span> <span className={`font-semibold ${currentCondition.aqi > 300 ? "text-red-300" : "text-foreground"}`}>{currentCondition.aqi > 300 ? "ACTIVE" : "SAFE"}</span></p>
                  <p><span className="text-muted-foreground">📉 Activity Drop:</span> <span className={`font-semibold ${noOrdersFor30Min ? "text-red-300" : "text-foreground"}`}>{noOrdersFor30Min ? "DETECTED" : "NORMAL"}</span></p>
                  <p><span className="text-muted-foreground">🧠 AI Decision:</span> <span className={`font-semibold ${claimTriggered ? "text-amber-300" : "text-foreground"}`}>{claimTriggered ? "Income Loss Confirmed" : "Monitoring"}</span></p>
                  <p><span className="text-muted-foreground">📄 Claim Status:</span> <span className={`font-semibold ${claimStatus === "approved" ? "text-emerald-300" : claimStatus === "rejected" ? "text-red-300" : "text-amber-300"}`}>{claimStatus === "approved" ? "Auto-Created" : claimStatus === "rejected" ? "Not Eligible" : claimTriggered ? "Auto-Created" : "No disruption detected"}</span></p>
                  <p>
                    <span className="text-muted-foreground">💸 Payout:</span>{" "}
                    <span className={`font-semibold ${claimStatus === "approved" ? "text-emerald-300" : claimStatus === "rejected" ? "text-red-300" : "text-amber-300"}`}>
                      {claimStatus === "pending" && claimTriggered
                        ? `₹${claimAmount} Processing...`
                        : claimStatus === "approved"
                          ? `₹${claimAmount} Credited`
                          : "₹0"}
                    </span>
                  </p>
                  <p><span className="text-muted-foreground">Triggered by:</span> <span className="font-semibold text-foreground">{claimTriggersLabel}</span></p>
                </div>

                <div className="mt-3">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto px-4 gap-2 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] transition-all"
                    onClick={() => void refreshClaim()}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Refresh claim
                  </Button>
                </div>

                {canUseTestMode && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={triggerAutoPayoutTest}
                    >
                      Trigger test auto payout
                    </Button>
                    {testModeEnabled && (
                      <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                        Test mode active
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-2">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground tracking-tight">⚡ Live Risk Monitoring</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="glass-card rounded-xl p-6 bg-[#0F172A]/80 border border-border/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-foreground">Today's Risk</h3>
                    <span className={rainImpactLevel === "HIGH" ? "risk-badge-high" : rainImpactLevel === "MEDIUM" ? "risk-badge-medium" : "risk-badge-low"}>{rainImpactLevel}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke={rainImpactLevel === "HIGH" ? "hsl(var(--risk-high))" : rainImpactLevel === "MEDIUM" ? "hsl(var(--risk-medium))" : "hsl(var(--risk-low))"} strokeWidth="8" strokeDasharray={`${(rainImpactPercent / 100) * 264} 264`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">{rainImpactPercent}%</span>
                    </div>
                    <div className="space-y-1 text-sm flex-1">
                      <p className="text-foreground font-medium">Score: {rainImpactAssessment.riskScore.toFixed(2)} ({rainImpactLevel})</p>
                      <p className="text-muted-foreground">Rain {currentCondition.rainMm}mm • AQI {currentCondition.aqi}</p>
                      <p className="text-xs text-muted-foreground">{isWeatherLoading ? "Refreshing live weather..." : "Live explainable risk model active."}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-6 bg-[#0F172A]/80 border border-border/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-foreground">📊 Next 6 Hours Prediction</h3>
                    <div className="flex gap-1.5">
                      {["Low", "Medium", "High"].map((l) => (
                        <span key={l} className={`text-[10px] px-2 py-0.5 rounded-full ${l === "Low" ? "risk-badge-low" : l === "Medium" ? "risk-badge-medium" : "risk-badge-high"}`}>{l}</span>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={nextSixHoursForecast.map((point) => ({ time: point.hour, score: point.riskScore }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)" />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(220, 10%, 70%)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 70%)" }} domain={[0, 1]} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
                      <Tooltip formatter={(value: number) => `${Math.round(Number(value) * 100)}% risk`} />
                      <Line type="monotone" dataKey="score" stroke="hsl(213, 94%, 68%)" strokeWidth={3} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-[#0F172A]/70 p-5 shadow-sm">
                  <h4 className="font-display text-base font-semibold text-foreground">Smart Risk Triggers (Live Monitoring)</h4>
                  <div className="mt-3 grid grid-cols-1 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">🌧 Rain Monitoring</span><span className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(rainTriggerState)}`}>{rainTriggerState}</span></div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">⚠️ AQI Monitoring</span><span className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(aqiTriggerState)}`}>{aqiTriggerState}</span></div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">📉 Delivery Activity</span><span className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(zoneTriggerState)}`}>{zoneTriggerState}</span></div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">🧠 Platform Health</span><span className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(platformTriggerState)}`}>{platformTriggerState}</span></div>
                    <div className="flex items-center justify-between py-2"><span className="text-muted-foreground">🚦 Traffic Conditions</span><span className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(trafficTriggerState)}`}>{trafficTriggerState}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Payout is triggered only when multiple conditions are satisfied.</p>
                </div>
                <PayoutStatusCard event={demoState.lastEvent} />
              </div>
            </div>
          </section>

          {/* NEW: AI Risk Explainability and Data Sources */}
          <section className="space-y-4 pt-2">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground tracking-tight">🤖 AI Risk Analysis</h2>
            <div className="grid grid-cols-1 gap-6">
              {riskResult && (
                <RiskExplainability result={riskResult} aiNarrative={aiNarrative} />
              )}
              <DataSourceBadge 
                weatherFetchedAt={liveWeatherData?.fetchedAt}
                aqiFetchedAt={liveAqiData?.fetchedAt}
              />
            </div>
          </section>

          {/* NEW: AI Earnings Optimization */}
          <section className="space-y-4 pt-2">
            <div className="glass-card rounded-xl p-6 bg-[#0F172A]/75 border border-border/60">
              <EarningsOptimization city={userCity} forecastData={forecast} />
            </div>
          </section>

          <section className="space-y-4 pt-2">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground tracking-tight">💡 Smart Recommendations</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div ref={plansSectionRef} className="glass-card rounded-xl p-6 bg-[#0F172A]/75 border border-border/60">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-foreground">Available Plans</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">No waiting period</span>
                </div>
                {user?.salary && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-100">
                    <p className="text-xs font-semibold mb-1">💡 Plan Recommendation Based on Your Salary</p>
                    <p className="text-xs">
                      Your monthly salary is ₹{Number(user.salary).toLocaleString('en-IN')}. We recommend the{' '}
                      {user.salary < 40000 ? 'Low Risk Plan' : user.salary <= 80000 ? 'Medium Risk Plan' : 'Premium Risk Plan'} for optimal coverage.
                    </p>
                  </div>
                )}
                <div className="grid md:grid-cols-1 xl:grid-cols-2 gap-4">
                  {planCatalog.map((plan) => {
                    const selected = activePlan?.id === plan.id;
                    const inPayment = paymentPlanId === plan.id;
                    // Use salary-based recommendation if salary is available, otherwise use risk-based
                    const recommended = user?.salary ? plan.id === salaryRecommendedPlanId : plan.id === recommendedPlanId;
                    return (
                      <div key={plan.id} className={`rounded-xl p-4 ${selected ? "bg-accent/10 border border-accent/30" : "bg-card/50 border border-border/50"}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-display text-sm font-semibold text-foreground">{tx(language, plan.name, planNameHindi[plan.name] || plan.name)}</h4>
                          {recommended && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/40 font-semibold">Recommended ⭐</span>}
                        </div>
                        <div className="space-y-1 text-xs mb-3">
                          <div className="flex justify-between"><span className="text-muted-foreground">Window</span><span className="text-foreground">{plan.window}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Premium</span><span className="text-foreground">{plan.premium}/week</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Payout</span><span className="text-foreground">{plan.payout}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Auto Trigger</span><span className="text-foreground text-right">{tx(language, plan.triggers, planTriggerHindi[plan.triggers] || plan.triggers)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Best For</span><span className="text-foreground text-right">{tx(language, plan.bestFor, planBestForHindi[plan.bestFor] || plan.bestFor)}</span></div>
                        </div>
                        {selected ? (
                          <Button className="w-full gap-2" variant="secondary"><Wallet className="w-4 h-4" /> Selected</Button>
                        ) : inPayment ? (
                          <div className="space-y-2">
                            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 text-center">
                              💳 Enter UPI on Razorpay
                            </div>
                            <Button className="w-full" disabled={isProcessing} onClick={() => handlePurchase(plan.id)} variant="default">
                              {isProcessing ? tx(language, "Processing...", "प्रोसेसिंग...") : "Open Payment"}
                            </Button>
                            <Button className="w-full" variant="outline" disabled={isProcessing} onClick={() => setPaymentPlanId(null)}>
                              {tx(language, "Cancel", "रद्द करें")}
                            </Button>
                            {paymentStatus && <p className={`mt-1 text-xs text-center ${paymentStatus.includes("✅") || paymentStatus.includes("Successful") ? "text-green-600" : "text-orange-400"}`}>{paymentStatus}</p>}
                          </div>
                        ) : (
                          <Button className="w-full gap-2" onClick={() => startPlanPayment(plan.id)}><Wallet className="w-4 h-4" /> {tx(language, "Choose Plan", "प्लान चुनें")}</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card rounded-xl p-6 border border-border/60 bg-[#0F172A]/75">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-semibold text-foreground">AI Earnings Optimization</h3>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-2 mt-4">
                  {shiftRecommendations.map((item) => (
                    <div key={item.time} className="p-3 rounded-lg bg-muted/20 border border-border/40">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{item.time}</span>
                        </div>
                        <span className={`risk-badge-${item.badge}`}>{item.risk}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pl-6">
                        <span>{tx(language, item.reason, item.reason === "Avoid long shifts unless necessary" ? "ज़रूरत न हो तो लंबी शिफ्ट से बचें" : item.reason === "Work with short breaks and alerts on" ? "छोटे ब्रेक लेकर और अलर्ट ऑन रखकर काम करें" : "सुरक्षित और स्थिर काम के लिए बेहतरीन स्लॉट")}</span>
                        <span>{item.earnings}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-2">
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground/95 tracking-tight">🔒 System Trust & Safety</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 opacity-70">
              <div className="rounded-xl p-4 bg-[#0F172A]/55 border border-border/40 text-sm">
                <p className="font-semibold text-foreground">Security Check</p>
                <p className="text-xs text-muted-foreground mt-2">✔ Location verified</p>
                <p className="text-xs text-muted-foreground">✔ Device verified</p>
                <p className="text-xs text-muted-foreground">✔ {demoState.fraudStatus === "Clear" ? "No suspicious activity" : "Activity flagged"}</p>
              </div>
              <div className="rounded-xl p-4 bg-[#0F172A]/55 border border-border/40 text-sm">
                <p className="font-semibold text-foreground">Why Trust This System</p>
                <p className="text-xs text-muted-foreground mt-2">• Real-time weather APIs</p>
                <p className="text-xs text-muted-foreground">• No manual claims</p>
                <p className="text-xs text-muted-foreground">• Transparent payout logic</p>
              </div>
              <div className="rounded-xl p-4 bg-[#0F172A]/55 border border-border/40 text-sm">
                <p className="font-semibold text-foreground">Emergency Support (Future Scope)</p>
                <p className="text-xs text-muted-foreground mt-2">• Inactivity detection for emergency cases</p>
                <p className="text-xs text-muted-foreground">• Trusted contact alert workflow</p>
                <p className="text-xs text-muted-foreground">• Partner integration on roadmap</p>
              </div>
            </div>
          </section>
        </div>

        {policyActive && (
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible" className="glass-card p-6">
              <h3 className="font-display font-semibold mb-4 text-foreground">Payout History</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payoutHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="hsl(220, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Total Payouts (6 months)</span>
                <span className="font-display font-bold text-lg text-foreground">₹{totalPayouts}</span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={7} initial="hidden" animate="visible" className="glass-card p-6 rounded-xl shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Transaction History</h3>
                <span className="text-xs text-muted-foreground">Wallet Balance: ₹{demoState.walletBalance}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">🧾 All payouts are automatically credited based on verified conditions</p>
              <div className="space-y-2">
                {demoState.transactions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/80 p-4 bg-muted/30 text-sm text-muted-foreground">
                    No transactions yet. Activate insurance and simulate an event to generate payout history.
                  </div>
                )}
                {demoState.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{tx.kind === "PAYOUT" ? "Auto Payout" : "Premium Payment"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{tx.label}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${tx.kind === "PAYOUT" ? "text-accent" : "text-foreground"}`}>
                        {tx.kind === "PAYOUT" ? `+₹${tx.amount}` : `-₹${tx.amount}`}
                      </span>
                      <div className={`text-xs font-medium ${tx.status === "Credited" ? "text-accent" : tx.kind === "PAYOUT" ? "text-amber-300" : "text-muted-foreground"}`}>
                        {tx.status === "Credited" ? (
                          isSimulationOnlyPayout(tx)
                            ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Simulated (wallet unchanged)</span>
                            : <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Credited</span>
                        ) : tx.kind === "PAYOUT" ? (
                          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Processing</span>
                        ) : (
                          "Debited"
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerDashboard;
