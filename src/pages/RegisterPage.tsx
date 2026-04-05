import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, User, ArrowRight, MapPin, CloudRain, Wind, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { setSession } from "@/lib/session";
import { registerUser, validateEmailAuthenticity } from "@/lib/auth";
import { syncWorkerToDb } from "@/lib/dbApi";
import { tx, useAppLanguage } from "@/lib/preferences";

const RegisterPage = () => {
  const language = useAppLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [personaType, setPersonaType] = useState<"rain" | "pollution" | "normal">("rain");
  const [deliveryPartner, setDeliveryPartner] = useState<"Zomato" | "Swiggy" | "Amazon" | "Blinkit">("Zomato");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailCheck = validateEmailAuthenticity(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message || tx(language, "Invalid email.", "अमान्य ईमेल।"));
      return;
    }

    if (password.trim().length < 6) {
      setError(tx(language, "Password must be at least 6 characters.", "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"));
      return;
    }

    if (!city.trim()) {
      setError(tx(language, "Please enter your city.", "कृपया अपना शहर दर्ज करें।"));
      return;
    }

    const registration = registerUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      city: city.trim(),
      persona_type: personaType,
      deliveryPartner,
      role: "worker",
      phone: "",
      vehicleType: "",
      emergencyContact: "",
    });

    if (!registration.ok) {
      setError(registration.message || tx(language, "Unable to register right now.", "अभी रजिस्टर नहीं हो पाया।"));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setSession({
      name: name.trim(),
      email: normalizedEmail,
      city: city.trim(),
      persona_type: personaType,
      deliveryPartner,
      phone: "",
      vehicleType: "",
      emergencyContact: "",
      role: "worker",
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
    });

    try {
      await syncWorkerToDb({
        name: name.trim(),
        email: normalizedEmail,
        city: city.trim(),
        persona_type: personaType,
        delivery_partner: deliveryPartner,
      });
    } catch {
      // Keep local registration working even if DB sync is temporarily unavailable.
    }

    navigate("/dashboard");
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
          <p className="text-primary-foreground/70 max-w-sm mx-auto">{tx(language, "Get instant income protection powered by AI. Sign up in under a minute.", "AI से संचालित तुरंत आय सुरक्षा पाएँ। एक मिनट से भी कम समय में साइन अप करें।")}</p>
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

          <h1 className="font-display text-2xl font-bold mb-1 text-foreground">{tx(language, "Create Account", "खाता बनाएं")}</h1>
          <p className="text-muted-foreground text-sm mb-8">{tx(language, "Start protecting your income in minutes", "कुछ ही मिनटों में अपनी आय की सुरक्षा शुरू करें")}</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Full name", "पूरा नाम")} value={name} onChange={e => setName(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Email address", "ईमेल पता")} type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "City (e.g. Mumbai)", "शहर (जैसे मुंबई)")} value={city} onChange={e => setCity(e.target.value)} className="pl-10" required />
            </div>
            <div className="rounded-lg border border-border/70 p-3 bg-card/50">
              <p className="text-sm font-medium text-foreground mb-2">{tx(language, "Work Environment", "कार्य परिवेश")}</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPersonaType("rain")}
                  className={`rounded-md border px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 ${personaType === "rain" ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                >
                  <CloudRain className="w-3.5 h-3.5" /> Rain
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaType("pollution")}
                  className={`rounded-md border px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 ${personaType === "pollution" ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                >
                  <Wind className="w-3.5 h-3.5" /> Pollution
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaType("normal")}
                  className={`rounded-md border px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 ${personaType === "normal" ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                >
                  <Sun className="w-3.5 h-3.5" /> Normal
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-3 bg-card/50">
              <p className="text-sm font-medium text-foreground mb-2">Delivery Platform</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Zomato", icon: "🍽️" },
                  { label: "Swiggy", icon: "🛵" },
                  { label: "Amazon", icon: "📦" },
                  { label: "Blinkit", icon: "⚡" },
                ].map((partner) => (
                  <button
                    key={partner.label}
                    type="button"
                    onClick={() => setDeliveryPartner(partner.label as "Zomato" | "Swiggy" | "Amazon" | "Blinkit")}
                    className={`rounded-md border px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 ${deliveryPartner === partner.label ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                  >
                    <span>{partner.icon}</span>
                    <span>{partner.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Password", "पासवर्ड")} type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
            </div>
            {error && <p className="text-sm text-risk-high">{error}</p>}
            <Button type="submit" className="w-full gap-2">{tx(language, "Start Protection", "प्रोटेक्शन शुरू करें")} <ArrowRight className="w-4 h-4" /></Button>
            <p className="text-xs text-muted-foreground text-center">🔒 No hidden charges • Weekly flexible plans</p>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {tx(language, "Already have an account?", "पहले से खाता है?")} <Link to="/login" className="text-primary font-medium hover:underline">{tx(language, "Sign in", "साइन इन")}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterPage;
