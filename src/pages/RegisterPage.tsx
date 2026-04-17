import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, User, ArrowRight, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { setSession } from "@/lib/session";
import { registerUser, validateEmailAuthenticity } from "@/lib/auth";
import { tx, useAppLanguage } from "@/lib/preferences";

const RegisterPage = () => {
  const language = useAppLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [salary, setSalary] = useState("");
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

    if (!salary.trim() || isNaN(Number(salary)) || Number(salary) <= 0) {
      setError(tx(language, "Please enter a valid monthly salary.", "कृपया एक वैध मासिक वेतन दर्ज करें।"));
      return;
    }

    const registration = await registerUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      city: city.trim(),
      salary: Number(salary),
      persona_type: "balanced", // Auto-detected dynamically from live conditions
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

    if (!registration.session) {
      setError(tx(language, "Unable to create session after registration.", "रजिस्ट्रेशन के बाद सेशन नहीं बन पाया।"));
      return;
    }

    setSession(registration.session);

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

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Full Name */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Full name", "पूरा नाम")} value={name} onChange={e => setName(e.target.value)} className="pl-10 h-11" required />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Email address", "ईमेल पता")} type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11" required />
            </div>

            {/* City */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "City (e.g. Mumbai)", "शहर (जैसे मुंबई)")} value={city} onChange={e => setCity(e.target.value)} className="pl-10 h-11" required />
            </div>

            {/* Monthly Salary */}
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Monthly Salary (₹)", "मासिक वेतन (₹)")} type="number" value={salary} onChange={e => setSalary(e.target.value)} className="pl-10 h-11" required />
            </div>

            {/* Delivery Platform */}
            <div className="rounded-lg border border-border/70 p-4 bg-card/50 backdrop-blur-sm">
              <p className="text-sm font-semibold text-foreground mb-3">Select Delivery Platform</p>
              <div className="grid grid-cols-2 gap-2.5">
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
                    className={`rounded-md border py-2.5 px-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      deliveryPartner === partner.label 
                        ? "border-primary bg-primary/15 text-primary shadow-sm" 
                        : "border-border/70 text-foreground hover:border-border bg-card/30"
                    }`}
                  >
                    <span className="text-base">{partner.icon}</span>
                    <span>{partner.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={tx(language, "Password", "पासवर्ड")} type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-11" required />
            </div>

            {/* Error Message */}
            {error && <p className="text-sm text-risk-high font-medium bg-risk-high/10 rounded-md p-3">{error}</p>}

            {/* Submit Button */}
            <Button type="submit" className="w-full h-11 gap-2 font-semibold">{tx(language, "Start Protection", "प्रोटेक्शन शुरू करें")} <ArrowRight className="w-4 h-4" /></Button>

            {/* Security Note */}
            <p className="text-xs text-muted-foreground text-center font-medium">🔒 No hidden charges • Weekly flexible plans</p>
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
