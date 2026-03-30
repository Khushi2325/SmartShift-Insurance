import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, CloudRain, Wind, Thermometer, Clock, MapPin, TrendingUp, CheckCircle2, Activity, User, LogOut, Receipt, Wallet, Settings, CircleUserRound, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { clearSession, getSession, setSession, UserSession } from "@/lib/session";
import PayoutStatusCard from "@/components/PayoutStatusCard";
import {
  calculateRiskLevel,
  DemoEventType,
  FraudScenario,
  getWorkerDemoState,
  premiumForRisk,
  recordPremiumPayment,
  saveWorkerDemoState,
  simulateInsuranceEvent,
} from "@/lib/insuranceDemo";

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
  { id: "day-shield", name: "Day Shield", window: "8:00 AM - 8:00 PM", premium: "₹45", payout: "₹500", triggers: "Rain, AQI, Heat" },
  { id: "rush-hour-cover", name: "Rush Hour Cover", window: "6:00 AM - 11:00 AM", premium: "₹25", payout: "₹300", triggers: "Rain, AQI" },
  { id: "night-safety", name: "Night Safety", window: "6:00 PM - 11:00 PM", premium: "₹30", payout: "₹350", triggers: "Rain, Heat" },
];

const cityConditions: Record<string, { rain: string; rainMm: number; aqi: number; temp: string; risk: number }> = {
  Mumbai: { rain: "Heavy", rainMm: 56, aqi: 142, temp: "36°C", risk: 0.72 },
  Delhi: { rain: "None", rainMm: 0, aqi: 188, temp: "39°C", risk: 0.76 },
  Bangalore: { rain: "Light", rainMm: 3, aqi: 74, temp: "29°C", risk: 0.31 },
  Chennai: { rain: "Moderate", rainMm: 19, aqi: 102, temp: "35°C", risk: 0.58 },
};

const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Delhi: { latitude: 28.6139, longitude: 77.209 },
  Bangalore: { latitude: 12.9716, longitude: 77.5946 },
  Chennai: { latitude: 13.0827, longitude: 80.2707 },
};

const defaultCondition = { rain: "--", rainMm: 0, aqi: 0, temp: "--", risk: 0.1 };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getRainLabel = (rainMm: number) => {
  if (rainMm >= 7) return "Heavy";
  if (rainMm >= 2) return "Moderate";
  if (rainMm > 0) return "Light";
  return "None";
};

const parseMoney = (value: string) => Number(value.replace(/[^0-9.]/g, ""));

const getBadge = (riskScore: number): "low" | "medium" | "high" => {
  if (riskScore >= 0.65) return "high";
  if (riskScore >= 0.4) return "medium";
  return "low";
};

const toLabel = (hour: number) => `${((hour + 11) % 12) + 1}${hour >= 12 ? "PM" : "AM"}`;

const resolveCoordinates = async (city: string) => {
  const direct = cityCoordinates[city];
  if (direct) return direct;

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  if (!response.ok) return null;

  const data = await response.json();
  const first = data?.results?.[0];
  if (!first) return null;

  return { latitude: Number(first.latitude), longitude: Number(first.longitude) };
};

const computeRiskScore = (rain: number, aqi: number, temp: number, precipProbability: number, mode: UserSession["preferences"]["aiRecommendationMode"]) => {
  const rainScore = clamp(Math.max(rain / 10, precipProbability / 100), 0, 1);
  const aqiScore = clamp((aqi - 50) / 150, 0, 1);
  const tempScore = clamp((temp - 30) / 15, 0, 1);

  const weights = mode === "safety-first"
    ? { rain: 0.5, aqi: 0.35, temp: 0.15 }
    : mode === "earnings-first"
      ? { rain: 0.35, aqi: 0.35, temp: 0.3 }
      : { rain: 0.45, aqi: 0.35, temp: 0.2 };

  return clamp(weights.rain * rainScore + weights.aqi * aqiScore + weights.temp * tempScore, 0.08, 0.98);
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
  const navigate = useNavigate();
  const [user, setUser] = useState<UserSession | null>(() => getSession());
  const [liveCondition, setLiveCondition] = useState<{ rain: string; rainMm: number; aqi: number; temp: string; risk: number } | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendPoint[]>(fallbackTrend);
  const [paymentPlanId, setPaymentPlanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card">("upi");
  const [paymentIdentity, setPaymentIdentity] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [fraudScenario, setFraudScenario] = useState<FraudScenario>("none");
  const [simulatingEvent, setSimulatingEvent] = useState<DemoEventType | null>(null);
  const [demoState, setDemoState] = useState(() => (user ? getWorkerDemoState(user) : getWorkerDemoState({ email: "" })));
  const [payoutCelebration, setPayoutCelebration] = useState<{ amount: number; walletBalance: number } | null>(null);

  const userName = user?.name || "Worker";
  const userCity = user?.city?.trim() || "";
  const displayCity = userCity || "Update city in profile";
  const policyActive = Boolean(user?.policyActive);

  const currentCondition = useMemo(() => liveCondition || cityConditions[userCity] || defaultCondition, [liveCondition, userCity]);

  const activePlan = useMemo(() => {
    if (!user?.purchasedPlans?.length) return null;
    return planCatalog.find((plan) => plan.id === user.purchasedPlans[0]) || null;
  }, [user]);

  const shiftRecommendations = useMemo(
    () => buildRecommendations(trendData, user?.preferences?.aiRecommendationMode || "balanced"),
    [trendData, user?.preferences?.aiRecommendationMode],
  );

  const formattedDate = useMemo(
    () => new Date().toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" }),
    [],
  );

  const riskLevel = demoState.riskLevel;
  const riskPercent = riskLevel === "HIGH" ? 90 : riskLevel === "MEDIUM" ? 60 : 25;
  const recommendedPlanId = riskLevel === "HIGH" ? "day-shield" : riskLevel === "MEDIUM" ? "rush-hour-cover" : "night-safety";
  const selectedFraudReason = fraudScenario === "sudden-jump"
    ? "Location mismatch"
    : fraudScenario === "static-location"
      ? "Abnormal pattern"
      : "None";

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

  const totalPayouts = useMemo(
    () => demoState.transactions
      .filter((tx) => tx.kind === "PAYOUT" && tx.status === "Credited")
      .reduce((sum, tx) => sum + tx.amount, 0),
    [demoState.transactions],
  );

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const startPlanPayment = (planId: string) => {
    setPaymentPlanId(planId);
    setPaymentAmount("");
    setPaymentRef("");
    setPaymentMethod("upi");
    setPaymentIdentity("");
    setPaymentProcessing(false);
    setPaymentError("");
  };

  const handleActivatePlan = async (planId: string) => {
    if (!user) return;
    const plan = planCatalog.find((item) => item.id === planId);
    if (!plan) return;

    const expected = parseMoney(plan.premium);
    const entered = Number(paymentAmount);

    if (!Number.isFinite(entered) || entered <= 0) {
      setPaymentError("Please enter the payment amount.");
      return;
    }
    if (Math.round(entered) !== Math.round(expected)) {
      setPaymentError(`Entered amount must be exactly ${plan.premium} for this plan.`);
      return;
    }

    if (!paymentIdentity.trim()) {
      setPaymentError(paymentMethod === "upi" ? "Please enter UPI ID." : "Please enter card reference.");
      return;
    }

    if (paymentMethod === "upi" && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(paymentIdentity.trim())) {
      setPaymentError("Please enter a valid UPI ID (example: name@bank). ");
      return;
    }

    setPaymentProcessing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1200));

    const next = {
      ...user,
      policyActive: true,
      purchasedPlans: [planId, ...(user.purchasedPlans || []).filter((item) => item !== planId)],
    };
    setSession(next);
    setUser(next);
    setPaymentPlanId(null);
    setPaymentAmount("");
    setPaymentRef("");
    setPaymentIdentity("");
    setPaymentProcessing(false);
    setPaymentError("");

    const updatedDemo = recordPremiumPayment(next, expected, plan.name);
    setDemoState(updatedDemo);
    toast.success("Insurance activated. You can now simulate disruption events.");
  };

  const handleSimulateEvent = async (eventType: DemoEventType) => {
    if (!user || !policyActive) return;

    setSimulatingEvent(eventType);
    await new Promise((resolve) => window.setTimeout(resolve, 700));

    const metrics = eventType === "Rain"
      ? { rainfallMm: 62, aqi: currentCondition.aqi }
      : { rainfallMm: currentCondition.rainMm, aqi: 336 };

    const result = simulateInsuranceEvent(user, eventType, metrics, fraudScenario);
    setDemoState(result.state);
    setSimulatingEvent(null);

    if (result.status === "Credited" && result.payoutAmount > 0) {
      setPayoutCelebration({ amount: result.payoutAmount, walletBalance: result.state.walletBalance });
      toast.success(`₹${result.payoutAmount} credited successfully`);
      return;
    }

    if (result.status === "Under Review") {
      toast.warning("Potential fraud detected. Claim marked as Under Review.");
      return;
    }

    toast("No payout triggered for this simulation.");
  };

  useEffect(() => {
    if (!user) return;
    setDemoState(getWorkerDemoState(user));
  }, [user?.email]);

  useEffect(() => {
    if (!user) return;
    const derivedRisk = calculateRiskLevel({ rainfallMm: currentCondition.rainMm, aqi: currentCondition.aqi });
    const premium = premiumForRisk(derivedRisk);
    if (derivedRisk !== demoState.riskLevel || premium !== demoState.weeklyPremium) {
      const next = { ...demoState, riskLevel: derivedRisk, weeklyPremium: premium };
      setDemoState(next);
      saveWorkerDemoState(user, next);
    }
  }, [currentCondition.rainMm, currentCondition.aqi, demoState, user]);

  useEffect(() => {
    if (!payoutCelebration) return;
    const timeoutId = window.setTimeout(() => setPayoutCelebration(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [payoutCelebration]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentWeather = async () => {
      if (!userCity) {
        setLiveCondition(null);
        setTrendData(fallbackTrend);
        return;
      }

      const mode = user?.preferences?.aiRecommendationMode || "balanced";
      setIsWeatherLoading(true);

      try {
        const coordinates = await resolveCoordinates(userCity);
        if (!coordinates) throw new Error("Coordinates not found");

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m,precipitation,rain&hourly=temperature_2m,precipitation_probability,rain&timezone=auto&forecast_days=1`;
        const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=us_aqi&hourly=us_aqi&timezone=auto&forecast_days=1`;

        const [weatherRes, airRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
        if (!weatherRes.ok || !airRes.ok) throw new Error("Unable to fetch live weather");

        const weatherData = await weatherRes.json();
        const airData = await airRes.json();

        const temp = Number(weatherData?.current?.temperature_2m ?? 0);
        const rain = Number(weatherData?.current?.rain ?? weatherData?.current?.precipitation ?? 0);
        const currentAqi = Number(airData?.current?.us_aqi ?? cityConditions[userCity]?.aqi ?? 100);
        const risk = computeRiskScore(rain, currentAqi, temp, Number(weatherData?.current?.precipitation ?? 0), mode);

        const hourlyTimes: string[] = weatherData?.hourly?.time || [];
        const hourlyTemps: number[] = weatherData?.hourly?.temperature_2m || [];
        const hourlyRain: number[] = weatherData?.hourly?.rain || [];
        const hourlyProb: number[] = weatherData?.hourly?.precipitation_probability || [];
        const hourlyAqi: number[] = airData?.hourly?.us_aqi || [];

        const nextTrend: TrendPoint[] = [];
        for (let i = 0; i < hourlyTimes.length; i += 1) {
          const date = new Date(hourlyTimes[i]);
          const hour = date.getHours();
          if (hour < 6 || hour > 20 || hour % 2 !== 0) continue;

          const pointRisk = computeRiskScore(
            Number(hourlyRain[i] ?? 0),
            Number(hourlyAqi[i] ?? currentAqi),
            Number(hourlyTemps[i] ?? temp),
            Number(hourlyProb[i] ?? 0),
            mode,
          );
          nextTrend.push({ time: toLabel(hour), score: Number(pointRisk.toFixed(2)), hour });
        }

        if (!cancelled) {
          setLiveCondition({
            rain: getRainLabel(rain),
            rainMm: Number(rain.toFixed(1)),
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

    loadCurrentWeather();
    const intervalId = window.setInterval(loadCurrentWeather, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userCity, user?.preferences?.aiRecommendationMode]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-foreground">SmartShift</span>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">Worker Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="text-xs">Admin Panel</Button>
              </Link>
            )}
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
                      <Receipt className="h-4 w-4" /> Plan: {activePlan.name}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 w-full">
                    <CircleUserRound className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-risk-high" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Good morning, {userName}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {displayCity} · {formattedDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {policyActive ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                <span className="text-sm font-medium text-accent">Policy Active</span>
                <span className="text-xs text-muted-foreground">· {activePlan?.window || "Coverage running"}</span>
              </div>
            ) : (
              <div className="text-xs md:text-sm px-3 py-2 rounded-lg bg-muted/50 border border-border/60 text-muted-foreground">
                Choose a plan, enter payment amount, and activate instantly
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} custom={0.5} initial="hidden" animate="visible" className="grid lg:grid-cols-3 gap-4">
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-display font-semibold text-foreground">Live Demo Controls</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">Guidewire DEVTrails Demo</span>
            </div>
            {payoutCelebration && (
              <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="mb-3 rounded-xl border-2 border-accent bg-risk-low-bg/70 p-4 shadow-lg shadow-accent/20">
                <p className="text-lg font-display font-bold text-accent flex items-center gap-2"><Sparkles className="w-5 h-5" /> Payout Triggered!</p>
                <p className="text-xl font-bold text-foreground mt-1">₹{payoutCelebration.amount} credited to your wallet</p>
                <p className="text-sm text-muted-foreground mt-1">Wallet updated instantly to ₹{payoutCelebration.walletBalance}</p>
              </motion.div>
            )}
            <div className="rounded-lg bg-card border border-border/60 p-3 mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Demo Flow</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full px-3 py-1 bg-primary/10 text-primary">1️⃣ Check Risk</span>
                <span className="rounded-full px-3 py-1 bg-primary/10 text-primary">2️⃣ Choose Plan</span>
                <span className="rounded-full px-3 py-1 bg-primary/10 text-primary">3️⃣ Simulate Event</span>
                <span className="rounded-full px-3 py-1 bg-primary/10 text-primary">4️⃣ Get Payout</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Helping delivery partners like Raju avoid income loss during disruptions.</p>
            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 mb-3">
              <p className="text-xs text-muted-foreground mb-2">Journey: Login → Dashboard → Risk → Activate Insurance → Simulate Event → Payout → History</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="rounded-md px-2 py-1 bg-card border border-border/60 text-foreground">Risk: {riskLevel}</span>
                <span className="rounded-md px-2 py-1 bg-card border border-border/60 text-foreground">Weekly Premium: ₹{demoState.weeklyPremium}</span>
                <span className="rounded-md px-2 py-1 bg-card border border-border/60 text-foreground">Fraud Mode: {selectedFraudReason}</span>
              </div>
            </div>
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
              <p className="text-xs font-medium text-muted-foreground">Core Impact</p>
              <p className="text-2xl md:text-3xl font-display font-bold text-foreground mt-1">💰 Wallet Balance: ₹{demoState.walletBalance}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Fraud Simulation:</span>
              <Button size="sm" variant={fraudScenario === "none" ? "default" : "outline"} onClick={() => setFraudScenario("none")}>Normal</Button>
              <Button size="sm" variant={fraudScenario === "sudden-jump" ? "default" : "outline"} onClick={() => setFraudScenario("sudden-jump")}>Sudden Location Jump</Button>
              <Button size="sm" variant={fraudScenario === "static-location" ? "default" : "outline"} onClick={() => setFraudScenario("static-location")}>Static During Event</Button>
            </div>
            {fraudScenario !== "none" && (
              <div className="mb-3 rounded-lg border border-risk-medium/40 bg-risk-medium-bg/50 p-3">
                <p className="text-sm font-semibold text-risk-medium">⚠️ Suspicious Activity Detected</p>
                <p className="text-xs text-muted-foreground mt-1">Reason: {selectedFraudReason}</p>
                <p className="text-xs text-muted-foreground">Status: Under Review</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!policyActive || simulatingEvent !== null} className="gap-2" onClick={() => handleSimulateEvent("Rain")}>
                <CloudRain className="w-4 h-4" />
                {simulatingEvent === "Rain" ? "Simulating..." : "Simulate Rain Event 🌧️"}
              </Button>
              <Button disabled={!policyActive || simulatingEvent !== null} variant="secondary" className="gap-2" onClick={() => handleSimulateEvent("AQI")}>
                <Wind className="w-4 h-4" />
                {simulatingEvent === "AQI" ? "Simulating..." : "Simulate Pollution Event 🌫️"}
              </Button>
            </div>
            {!policyActive && <p className="text-xs text-risk-medium mt-2">Activate a plan first to unlock event simulation and payouts.</p>}
            {demoState.fraudStatus !== "Clear" && (
              <div className="mt-3 rounded-lg border border-risk-medium/30 bg-risk-medium-bg/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-risk-medium"><AlertTriangle className="w-4 h-4" /> Suspicious Activity: Under Review</p>
                <p className="text-xs text-muted-foreground mt-1">{demoState.fraudReason || "Claim flagged for manual verification."}</p>
              </div>
            )}
          </div>

          <PayoutStatusCard event={demoState.lastEvent} />
        </motion.div>

        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible" className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Available Plans</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">No waiting period</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {planCatalog.map((plan) => {
              const selected = activePlan?.id === plan.id;
              const inPayment = paymentPlanId === plan.id;
              const recommended = plan.id === recommendedPlanId;
              return (
                <div key={plan.id} className={`rounded-xl border p-4 ${selected ? "border-accent/50 bg-accent/5" : "border-border/70 bg-card/60"}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-display text-base font-semibold text-foreground">{plan.name}</h4>
                    <div className="flex items-center gap-1">
                      {recommended && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Recommended Plan ⭐</span>}
                      {selected && <span className="risk-badge-low">Active</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm mb-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Window</span><span className="text-foreground">{plan.window}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Premium</span><span className="text-foreground">{plan.premium}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Max Payout</span><span className="text-foreground">{plan.payout}</span></div>
                    <div className="text-xs text-muted-foreground mt-1">Triggers: {plan.triggers}</div>
                  </div>

                  {selected ? (
                    <Button className="w-full gap-2" variant="secondary">
                      <Wallet className="w-4 h-4" /> Selected
                    </Button>
                  ) : inPayment ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                        <p className="text-xs font-medium text-foreground mb-1">Secure Payment Gateway</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant={paymentMethod === "upi" ? "default" : "outline"} className="h-8" onClick={() => setPaymentMethod("upi")}>UPI</Button>
                          <Button type="button" variant={paymentMethod === "card" ? "default" : "outline"} className="h-8" onClick={() => setPaymentMethod("card")}>Card</Button>
                        </div>
                      </div>
                      <Input
                        value={paymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value);
                          setPaymentError("");
                        }}
                        placeholder={`Enter exact premium ${plan.premium}`}
                      />
                      <Input
                        value={paymentIdentity}
                        onChange={(e) => {
                          setPaymentIdentity(e.target.value);
                          setPaymentError("");
                        }}
                        placeholder={paymentMethod === "upi" ? "UPI ID (name@bank)" : "Card ref (last 4 digits)"}
                      />
                      <Input
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="UPI / transaction ref (optional)"
                      />
                      {paymentError && <p className="text-xs text-risk-high">{paymentError}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button className="w-full" disabled={paymentProcessing} onClick={() => handleActivatePlan(plan.id)}>
                          {paymentProcessing ? "Processing..." : "Pay & Activate"}
                        </Button>
                        <Button className="w-full" variant="outline" disabled={paymentProcessing} onClick={() => setPaymentPlanId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button className="w-full gap-2" onClick={() => startPlanPayment(plan.id)}>
                      <Wallet className="w-4 h-4" /> Choose Plan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-4">
          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="visible" className="glass-card-elevated p-6 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground">Current Risk</h3>
              <span className={riskLevel === "HIGH" ? "risk-badge-high" : riskLevel === "MEDIUM" ? "risk-badge-medium" : "risk-badge-low"}>
                {riskLevel}
              </span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={riskLevel === "HIGH" ? "hsl(var(--risk-high))" : riskLevel === "MEDIUM" ? "hsl(var(--risk-medium))" : "hsl(var(--risk-low))"} strokeWidth="8" strokeDasharray={`${(riskPercent / 100) * 264} 264`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-foreground">
                  {riskPercent}%
                </span>
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" /> Rain</span>
                  <span className="font-medium text-risk-high">{currentCondition.rain} ({currentCondition.rainMm}mm)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Wind className="w-3.5 h-3.5" /> AQI</span>
                  <span className="font-medium text-risk-medium">{currentCondition.aqi}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> Heat</span>
                  <span className="font-medium text-risk-medium">{currentCondition.temp}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
              {isWeatherLoading ? "Refreshing live weather and AI score..." : userCity ? `Logic: Rain > 50mm = HIGH (₹60/week), AQI > 300 = MEDIUM (₹40/week), else LOW (₹20/week).` : "Add your city in profile to enable location-based risk insights."}
            </p>
            <p className="text-xs mt-2 text-foreground/80">
              {riskLevel === "HIGH" ? "High risk → higher chance of payout." : "Low risk → safer working conditions."}
            </p>
          </motion.div>

          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible" className="glass-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground">Risk Trend Today</h3>
              <div className="flex gap-2">
                {["Low", "Medium", "High"].map((l) => (
                  <span key={l} className={`text-xs px-2 py-0.5 rounded-full ${l === "Low" ? "risk-badge-low" : l === "Medium" ? "risk-badge-medium" : "risk-badge-high"}`}>{l}</span>
                ))}
              </div>
            </div>
            {policyActive ? (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} domain={[0, 1]} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
                  <Tooltip formatter={(value: number) => `${Math.round(Number(value) * 100)}% risk`} />
                  <Area type="monotone" dataKey="score" stroke="hsl(220, 70%, 45%)" fill="url(#riskGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[210px] rounded-lg border border-dashed border-border/80 bg-muted/30 flex items-center justify-center text-center px-6">
                <p className="text-sm text-muted-foreground">Activate any plan to unlock risk trends and payout analytics.</p>
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="glass-card p-6">
            <h3 className="font-display font-semibold mb-4 text-foreground">Active Policy</h3>
            {policyActive && activePlan ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">{activePlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coverage Window</span>
                  <span className="font-medium text-foreground">{activePlan.window}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Premium Paid</span>
                  <span className="font-medium text-foreground">{activePlan.premium}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dynamic Weekly Premium</span>
                  <span className="font-semibold text-foreground">₹{demoState.weeklyPremium}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Payout</span>
                  <span className="font-medium text-foreground">{activePlan.payout}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Triggers</span>
                  <span className="font-medium text-foreground">{activePlan.triggers}</span>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="flex items-center gap-1 text-accent font-medium">
                      <Activity className="w-3.5 h-3.5" /> Monitoring
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Fraud Check</span>
                    <span className={`font-medium ${demoState.fraudStatus === "Clear" ? "text-accent" : "text-risk-medium"}`}>
                      {demoState.fraudStatus === "Clear" ? "Clear" : "Under Review"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">No active policy yet. Select a plan and pay exact premium to activate it.</p>
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} custom={5} initial="hidden" animate="visible" className="glass-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-semibold text-foreground">AI Shift Recommendations</h3>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mb-4">Recommendations combine live weather, AQI, heat, and your selected AI mode.</p>
            <div className="space-y-2">
              {shiftRecommendations.map((item) => (
                <div key={item.time} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{item.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`risk-badge-${item.badge}`}>{item.risk}</span>
                      <span className="text-xs text-muted-foreground">Earnings: {item.earnings}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                    <span>{item.reason}</span>
                    <span>{item.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
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

            <motion.div variants={fadeUp} custom={7} initial="hidden" animate="visible" className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Transaction History</h3>
                <span className="text-xs text-muted-foreground">Wallet Balance: ₹{demoState.walletBalance}</span>
              </div>
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
                      <div className={`text-xs font-medium ${tx.status === "Credited" ? "text-accent" : tx.status === "Under Review" ? "text-risk-medium" : "text-muted-foreground"}`}>
                        {tx.status === "Credited" ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Credited</span>
                        ) : tx.status === "Under Review" ? (
                          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under Review</span>
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
