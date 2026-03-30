import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { getSession, setSession } from "@/lib/session";
import { authenticateUser, validateEmailAuthenticity } from "@/lib/auth";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailCheck = validateEmailAuthenticity(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message || "Please enter a valid email.");
      return;
    }

    const login = authenticateUser(email, password);
    if (!login.ok || !login.session) {
      setError(login.message || "Unable to login.");
      return;
    }

    const existing = getSession();
    if (existing && existing.email.toLowerCase() === login.session.email.toLowerCase()) {
      setSession({ ...existing, ...login.session, preferences: existing.preferences || login.session.preferences });
    } else {
      setSession(login.session);
    }

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
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">Welcome Back</h2>
          <p className="text-primary-foreground/70 max-w-sm mx-auto">Access your dashboard, view your coverage status, and manage your protection.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">SmartShift</span>
          </Link>

          <h1 className="font-display text-2xl font-bold mb-1 text-foreground">Sign in</h1>
          <p className="text-muted-foreground text-sm mb-8">Enter your credentials to access your account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
            </div>
            {error && <p className="text-sm text-risk-high">{error}</p>}
            <Button type="submit" className="w-full gap-2">Sign In <ArrowRight className="w-4 h-4" /></Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
