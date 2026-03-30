import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, User, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { setSession } from "@/lib/session";
import { registerUser, validateEmailAuthenticity } from "@/lib/auth";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailCheck = validateEmailAuthenticity(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message || "Invalid email.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!city.trim()) {
      setError("Please enter your city.");
      return;
    }

    const registration = registerUser({
      name: name.trim(),
      email: email.trim(),
      password,
      city: city.trim(),
      role: "worker",
      phone: "",
      vehicleType: "",
      emergencyContact: "",
    });

    if (!registration.ok) {
      setError(registration.message || "Unable to register right now.");
      return;
    }

    setSession({
      name: name.trim(),
      email: email.trim(),
      city: city.trim(),
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
      },
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        <div className="relative text-center px-12">
          <Shield className="w-16 h-16 text-primary-foreground mx-auto mb-6 opacity-90" />
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">Join SmartShift</h2>
          <p className="text-primary-foreground/70 max-w-sm mx-auto">Get instant income protection powered by AI. Sign up in under a minute.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-white border border-border/60 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="SmartShift logo" className="h-8 w-8 object-contain" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">SmartShift</span>
          </Link>

          <h1 className="font-display text-2xl font-bold mb-1 text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mb-8">Start protecting your income in minutes</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="City (e.g. Mumbai)" value={city} onChange={e => setCity(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
            </div>
            {error && <p className="text-sm text-risk-high">{error}</p>}
            <Button type="submit" className="w-full gap-2">Create Account <ArrowRight className="w-4 h-4" /></Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterPage;
