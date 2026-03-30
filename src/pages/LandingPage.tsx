import { motion } from "framer-motion";
import { Shield, Zap, Brain, CloudRain, Wind, Thermometer, ArrowRight, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getSession } from "@/lib/session";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const features = [
  { icon: Brain, title: "AI Risk Prediction", desc: "Real-time disruption risk scoring using weather, AQI, and environmental signals." },
  { icon: Zap, title: "Instant Payouts", desc: "Parametric triggers auto-process payouts when conditions cross thresholds." },
  { icon: Shield, title: "Fraud Protection", desc: "Multi-signal verification with behavioral analysis and graph-based detection." },
  { icon: BarChart3, title: "Smart Shifts", desc: "AI-recommended safer working windows to reduce exposure and maximize earnings." },
];

const steps = [
  { num: "01", title: "Sign Up & Select City", desc: "Register and choose your working city and preferences." },
  { num: "02", title: "Get Risk Assessment", desc: "AI evaluates weather, AQI, and conditions to generate your risk score." },
  { num: "03", title: "Activate Coverage", desc: "Pay a dynamic premium and activate protection for your shift window." },
  { num: "04", title: "Auto-Protected", desc: "If conditions cross thresholds, payout triggers automatically. No claims needed." },
];

const LandingPage = () => {
  const session = getSession();
  const dashboardPath = session?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">SmartShift</span>
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden md:block text-sm text-muted-foreground">Hi, {session.name}</span>
                <Link to={dashboardPath}>
                  <Button variant="outline" size="sm">Dashboard</Button>
                </Link>
                <Link to="/profile">
                  <Button size="sm">Profile</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <div className="container mx-auto text-center relative">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" /> AI-Powered Parametric Insurance
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="visible"
            className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
            Protect Your Income,{" "}
            <span className="gradient-text">Automatically</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} initial="hidden" animate="visible"
            className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
            SmartShift monitors weather, air quality, and environmental conditions — and pays you instantly when disruptions prevent you from working. No claims. No waiting.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible" className="flex items-center justify-center gap-4">
            <Link to={session ? dashboardPath : "/register"}>
              <Button size="lg" className="gap-2 px-8">
                {session ? "Open Dashboard" : "Start Protection"} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={dashboardPath}>
              <Button variant="outline" size="lg" className="px-8">View Demo</Button>
            </Link>
          </motion.div>

          {/* Floating condition cards */}
          <div className="mt-16 flex justify-center gap-4 flex-wrap">
            {[
              { icon: CloudRain, label: "Rain", value: "Heavy", risk: "high" },
              { icon: Wind, label: "AQI", value: "142", risk: "medium" },
              { icon: Thermometer, label: "Heat", value: "38°C", risk: "medium" },
            ].map((item, i) => (
              <motion.div key={item.label} variants={fadeUp} custom={4 + i} initial="hidden" animate="visible"
                className="glass-card-elevated px-5 py-4 flex items-center gap-3 animate-float"
                style={{ animationDelay: `${i * 0.5}s` }}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  item.risk === 'high' ? 'bg-risk-high-bg' : 'bg-risk-medium-bg'
                }`}>
                  <item.icon className={`w-5 h-5 ${item.risk === 'high' ? 'text-risk-high' : 'text-risk-medium'}`} />
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-display font-semibold text-foreground">{item.value}</p>
                </div>
                <span className={item.risk === 'high' ? 'risk-badge-high' : 'risk-badge-medium'}>
                  {item.risk === 'high' ? 'High' : 'Medium'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-foreground">How SmartShift Protects You</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Four intelligent layers working together to keep gig workers financially safe.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-6 hover:shadow-lg transition-shadow group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-foreground">Simple. Automatic. Fair.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">From signup to payout in four steps — no paperwork, no hassle.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div key={s.num} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="relative">
                <div className="glass-card p-6">
                  <span className="font-display text-4xl font-bold text-primary/15">{s.num}</span>
                  <h3 className="font-display font-semibold text-lg mt-2 mb-2 text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Traditional vs SmartShift */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-foreground">Why Parametric?</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="glass-card overflow-hidden">
            <div className="grid grid-cols-3 font-display font-semibold text-sm border-b border-border">
              <div className="p-4 bg-muted/50"></div>
              <div className="p-4 text-center text-muted-foreground">Traditional</div>
              <div className="p-4 text-center text-primary bg-primary/5">SmartShift</div>
            </div>
            {[
              ["Claim Filing", "Manual", "Automatic"],
              ["Verification", "Days/Weeks", "Real-time"],
              ["Process", "Human-heavy", "AI-driven"],
              ["Payout Speed", "Slow", "Instant"],
              ["Fraud Prevention", "Reactive", "Proactive"],
            ].map(([label, trad, smart]) => (
              <div key={label} className="grid grid-cols-3 text-sm border-b border-border/50 last:border-0">
                <div className="p-4 font-medium text-foreground">{label}</div>
                <div className="p-4 text-center text-muted-foreground">{trad}</div>
                <div className="p-4 text-center text-primary font-medium bg-primary/5 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {smart}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="glass-card-elevated p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ background: 'var(--gradient-hero)' }} />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 relative text-foreground">Ready to Protect Your Earnings?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8 relative">Join thousands of gig workers who never worry about weather disruptions again.</p>
            <Link to={session ? dashboardPath : "/register"} className="relative">
              <Button size="lg" className="gap-2 px-8">
                {session ? "Go To Dashboard" : "Get Started Free"} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-foreground">SmartShift Insurance</span>
          </div>
          <p>© 2026 SmartShift. AI-Powered Parametric Insurance.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
