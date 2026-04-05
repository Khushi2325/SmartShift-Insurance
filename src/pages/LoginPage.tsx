import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { getSession, setSession } from "@/lib/session";
import { ADMIN_DEMO_EMAIL, ADMIN_DEMO_PASSWORD, authenticateUser, validateEmailAuthenticity } from "@/lib/auth";
import { fetchUserProfile, fetchWorkerPortalState, syncWorkerToDb } from "@/lib/dbApi";
import { tx, useAppLanguage } from "@/lib/preferences";

const normalizePlanId = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["day-shield", "rush-hour-cover", "night-safety"].includes(normalized)) return normalized;
  if (normalized === "day shield") return "day-shield";
  if (normalized === "rush hour cover") return "rush-hour-cover";
  if (normalized === "night safety") return "night-safety";
  return null;
};

const LoginPage = () => {
  const language = useAppLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginMode, setLoginMode] = useState<"worker" | "admin">("worker");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailCheck = validateEmailAuthenticity(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message || tx(language, "Please enter a valid email.", "कृपया सही ईमेल दर्ज करें।"));
      return;
    }

    const login = authenticateUser(email, password);
    if (!login.ok || !login.session) {
      setError(login.message || tx(language, "Unable to login.", "लॉगिन नहीं हो सका।"));
      return;
    }

    let nextSession = {
      ...login.session,
      _sessionToken: Date.now(),
    };

    try {
      await syncWorkerToDb({
        name: login.session.name,
        email: login.session.email,
        city: login.session.city,
        persona_type: login.session.persona_type,
        delivery_partner: login.session.deliveryPartner,
      });
    } catch {
      // Keep login successful even if DB sync fails temporarily.
    }

    if (login.session.role === "worker") {
      try {
        const portal = await fetchWorkerPortalState(login.session.email);
        const activePolicy = portal.activePolicy;
        const activePlanId = activePolicy?.plan_id && activePolicy.plan_id !== "unknown"
          ? activePolicy.plan_id
          : activePolicy?.coverage_amount === 800
            ? "day-shield"
            : activePolicy?.coverage_amount === 1200
              ? "rush-hour-cover"
              : activePolicy?.coverage_amount === 1600
                ? "night-safety"
                : null;

        nextSession = {
          ...nextSession,
          policyActive: Boolean(activePolicy && String(activePolicy.status).toLowerCase() === "active"),
          purchasedPlans: activePlanId ? [activePlanId] : nextSession.purchasedPlans,
        };

        try {
          const profile = await fetchUserProfile(login.session.email);
          const planStillActive = Boolean(
            profile.active_plan
            && profile.plan_end_time
            && new Date(profile.plan_end_time).getTime() > Date.now(),
          );

          const persistedPlanId = normalizePlanId(profile.active_plan);
          if (planStillActive && persistedPlanId) {
            nextSession = {
              ...nextSession,
              policyActive: true,
              purchasedPlans: [persistedPlanId],
            };
          }
        } catch (err) {
          console.error("Portal/Profile fetch failed:", err);
        }
      } catch (err) {
        console.error("Portal/Profile fetch failed:", err);
      }
    }

    console.log("=== LOGIN DEBUG ===");
    console.log("policyActive:", nextSession.policyActive);
    console.log("purchasedPlans:", nextSession.purchasedPlans);
    console.log("_sessionToken:", nextSession._sessionToken);

    setSession(nextSession);

    navigate(nextSession.role === "admin" ? "/admin" : "/dashboard");
  };

  return (
    <div className="min-h-screen bg-transparent flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(140deg, hsl(222 44% 11%), hsl(216 34% 15%))' }}>
        <div
          className="absolute -top-12 -left-12 w-[300px] h-[300px] rounded-full"
          style={{ background: 'rgba(59, 130, 246, 0.2)', filter: 'blur(100px)' }}
        />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        <div className="relative text-center px-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/6" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.3)' }}>
            <Shield className="w-16 h-16 text-primary-foreground opacity-90" />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">Secure Your Earnings. Even When Conditions Don&apos;t.</h2>
          <p className="text-primary-foreground/70 max-w-sm mx-auto">{tx(language, "Access your dashboard, view your coverage status, and manage your protection.", "अपना डैशबोर्ड देखें, कवरेज स्टेटस जांचें और सुरक्षा मैनेज करें।")}</p>
          <div className="mt-6 space-y-2 text-sm text-primary-foreground/80 max-w-xs mx-auto text-left">
            <p>⚡ Real-time risk detection</p>
            <p>⚡ AI auto-claim + instant wallet credit</p>
            <p>⚡ Zero paperwork</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img src="/logo%202.png" alt="SmartShift logo" className="h-11 w-11 object-contain drop-shadow-sm" />
            <span className="font-display font-bold text-lg text-foreground">SmartShift</span>
          </Link>

          <h1 className="font-display text-2xl font-bold mb-1 text-foreground">{tx(language, "Sign in", "साइन इन")}</h1>
          <p className="text-muted-foreground text-sm mb-8">{tx(language, "Enter your credentials to access your account", "अपने खाते में जाने के लिए विवरण दर्ज करें")}</p>

          <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLoginMode("worker");
                setError("");
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${loginMode === "worker" ? "bg-blue-500/15 text-blue-300 border border-blue-400/40 shadow-sm" : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-background/40"}`}
            >
              Worker Login
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("admin");
                setEmail(ADMIN_DEMO_EMAIL);
                setPassword(ADMIN_DEMO_PASSWORD);
                setError("");
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${loginMode === "admin" ? "bg-red-500/15 text-red-300 border border-red-400/40 shadow-sm" : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-background/40"}`}
            >
              Admin Login
            </button>
          </div>

          <p className="mb-6 text-xs text-muted-foreground">
            {loginMode === "admin"
              ? "Admin mode selected: demo admin credentials are prefilled."
              : "Worker mode selected: sign in with your registered worker account."}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Email address", "ईमेल पता")} type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Password", "पासवर्ड")} type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
            </div>
            {error && <p className="text-sm text-risk-high">{error}</p>}
            <Button type="submit" className="w-full gap-2">{tx(language, "Sign In", "साइन इन")} <ArrowRight className="w-4 h-4" /></Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {tx(language, "Don't have an account?", "क्या आपका खाता नहीं है?")} <Link to="/register" className="text-primary font-medium hover:underline">{tx(language, "Sign up", "साइन अप")}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
