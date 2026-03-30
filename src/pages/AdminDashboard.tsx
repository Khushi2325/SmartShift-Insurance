import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Eye, Settings, Zap, TrendingUp, User, LogOut, Receipt, CircleUserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearSession, getSession, UserSession } from "@/lib/session";
import { getFlaggedUsers } from "@/lib/insuranceDemo";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

const stats = [
  { label: "Active Policies", value: "2,847", change: "+12%", icon: Shield, color: "text-primary" },
  { label: "Claims Today", value: "134", change: "+28%", icon: Zap, color: "text-risk-medium" },
  { label: "Fraud Flagged", value: "7", change: "-3%", icon: AlertTriangle, color: "text-risk-high" },
  { label: "Payouts Today", value: "₹48.2K", change: "+15%", icon: TrendingUp, color: "text-accent" },
];

const cityRisks = [
  { city: "Mumbai", risk: "High", score: 0.78, rain: "Heavy", aqi: 162, temp: "34°C", policies: 842 },
  { city: "Delhi", risk: "High", score: 0.85, rain: "None", aqi: 245, temp: "38°C", policies: 1204 },
  { city: "Bangalore", risk: "Low", score: 0.22, rain: "Light", aqi: 68, temp: "28°C", policies: 456 },
  { city: "Chennai", risk: "Medium", score: 0.55, rain: "Moderate", aqi: 95, temp: "33°C", policies: 345 },
];

const flaggedClaims = [
  { id: "CLM-3921", worker: "Ravi K.", city: "Delhi", reason: "GPS Anomaly", fraudScore: 0.87, amount: "₹420", time: "2m ago" },
  { id: "CLM-3918", worker: "Priya S.", city: "Mumbai", reason: "Timing Pattern", fraudScore: 0.72, amount: "₹380", time: "8m ago" },
  { id: "CLM-3915", worker: "Amit J.", city: "Delhi", reason: "Device Mismatch", fraudScore: 0.69, amount: "₹290", time: "15m ago" },
  { id: "CLM-3912", worker: "Neha P.", city: "Mumbai", reason: "IP Reputation", fraudScore: 0.65, amount: "₹350", time: "22m ago" },
  { id: "CLM-3908", worker: "Suresh M.", city: "Chennai", reason: "Group Pattern", fraudScore: 0.61, amount: "₹500", time: "30m ago" },
];

const claimVolume = [
  { hour: "00", claims: 12, fraudulent: 1 }, { hour: "04", claims: 8, fraudulent: 0 },
  { hour: "08", claims: 45, fraudulent: 3 }, { hour: "10", claims: 78, fraudulent: 5 },
  { hour: "12", claims: 134, fraudulent: 7 }, { hour: "14", claims: 98, fraudulent: 4 },
  { hour: "16", claims: 67, fraudulent: 2 }, { hour: "18", claims: 89, fraudulent: 6 },
  { hour: "20", claims: 56, fraudulent: 3 }, { hour: "22", claims: 34, fraudulent: 1 },
];

const fraudDistribution = [
  { name: "GPS Spoofing", value: 35, color: "hsl(0, 72%, 55%)" },
  { name: "Timing Abuse", value: 25, color: "hsl(38, 90%, 50%)" },
  { name: "Device Issues", value: 20, color: "hsl(220, 70%, 45%)" },
  { name: "Group Pattern", value: 15, color: "hsl(160, 60%, 40%)" },
  { name: "Other", value: 5, color: "hsl(220, 10%, 50%)" },
];

const ruleConfig = [
  { rule: "Rain Intensity Threshold", value: "Heavy (>50mm/hr)", status: "active" },
  { rule: "AQI Threshold", value: ">150 (Unhealthy)", status: "active" },
  { rule: "Heat Index Threshold", value: ">42°C", status: "active" },
  { rule: "Fraud Score Block", value: ">0.85", status: "active" },
  { rule: "Fraud Score Flag", value: ">0.60", status: "active" },
  { rule: "Min Coverage Duration", value: "2 hours", status: "active" },
  { rule: "Max Payout per Day", value: "₹1,000", status: "active" },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "claims" | "fraud" | "rules">("overview");
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSession());
  const [flaggedUsers, setFlaggedUsers] = useState(() => getFlaggedUsers());

  useEffect(() => {
    const sync = () => setFlaggedUsers(getFlaggedUsers());
    sync();
    const intervalId = window.setInterval(sync, 2000);
    window.addEventListener("storage", sync);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const dashboardStats = useMemo(() => {
    return stats.map((item) => {
      if (item.label !== "Fraud Flagged") return item;
      return {
        ...item,
        value: String(flaggedUsers.length),
        change: flaggedUsers.length > 0 ? "+Live" : "0",
      };
    });
  }, [flaggedUsers.length]);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

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
            <span className="text-sm text-muted-foreground hidden md:block">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">Worker View</Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                  aria-label="Open admin profile menu"
                >
                  <User className="w-4 h-4 text-primary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{user?.name || "Admin"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "admin@smartshift"}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Receipt className="h-4 w-4" /> Role: Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          {(["overview", "claims", "fraud", "rules"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardStats.map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i} initial="hidden" animate="visible"
              className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <span className={`text-xs font-medium ${s.change.startsWith('+') ? 'text-accent' : 'text-risk-high'}`}>
                  {s.change}
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* City Risk Map */}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Live City Risk Monitor</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                  <span className="text-xs text-muted-foreground">Real-time</span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                {cityRisks.map(c => (
                  <div key={c.city} className={`p-4 rounded-lg border ${
                    c.risk === 'High' ? 'border-risk-high/20 bg-risk-high-bg/30' :
                    c.risk === 'Medium' ? 'border-risk-medium/20 bg-risk-medium-bg/30' :
                    'border-risk-low/20 bg-risk-low-bg/30'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-semibold text-foreground">{c.city}</span>
                      <span className={`risk-badge-${c.risk.toLowerCase()}`}>{c.risk}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Score</span><span className="font-medium text-foreground">{c.score}</span></div>
                      <div className="flex justify-between"><span>Rain</span><span>{c.rain}</span></div>
                      <div className="flex justify-between"><span>AQI</span><span>{c.aqi}</span></div>
                      <div className="flex justify-between"><span>Temp</span><span>{c.temp}</span></div>
                      <div className="flex justify-between"><span>Policies</span><span className="font-medium text-foreground">{c.policies}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-4">
              <motion.div variants={fadeUp} custom={5} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-display font-semibold mb-4 text-foreground">Claims Volume (Today)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={claimVolume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'hsl(220, 10%, 50%)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(220, 10%, 50%)' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="claims" stroke="hsl(220, 70%, 45%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fraudulent" stroke="hsl(0, 72%, 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-display font-semibold mb-4 text-foreground">Fraud Distribution</h3>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={fraudDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                        paddingAngle={3} dataKey="value">
                        {fraudDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {fraudDistribution.map(f => (
                      <div key={f.name} className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                        <span className="text-muted-foreground flex-1">{f.name}</span>
                        <span className="font-medium text-foreground">{f.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {activeTab === "claims" && (
          <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground">Fraud Review Queue</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-risk-high-bg text-risk-high font-medium">{flaggedUsers.length} user(s) under review</span>
            </div>
            <div className="space-y-2">
              {flaggedUsers.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  No workers flagged yet. Trigger fraud simulation from worker dashboard to populate this queue.
                </div>
              )}
              {flaggedUsers.map((worker) => (
                <div key={worker.email} className="flex items-center justify-between p-4 rounded-lg bg-risk-medium-bg/30 border border-risk-medium/20">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="w-4 h-4 text-risk-medium" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{worker.name}</span>
                        <span className="text-xs text-muted-foreground">· {worker.email}</span>
                        <span className="text-xs text-muted-foreground">· {worker.city || "Unknown city"}</span>
                      </div>
                      <span className="text-xs text-risk-medium font-medium">{worker.reason}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-risk-medium-bg text-risk-medium">Under Review</span>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(worker.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
              {flaggedClaims.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="w-4 h-4 text-risk-high" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{c.id}</span>
                        <span className="text-xs text-muted-foreground">· {c.worker}</span>
                        <span className="text-xs text-muted-foreground">· {c.city}</span>
                      </div>
                      <span className="text-xs text-risk-high font-medium">{c.reason}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{c.amount}</span>
                      <div className="text-xs text-muted-foreground">{c.time}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-risk-high">Score: {c.fraudScore}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-accent hover:bg-accent/10">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-risk-high hover:bg-risk-high-bg">
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "fraud" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="glass-card p-6">
              <h3 className="font-display font-semibold mb-4 text-foreground">Fraud Signals Breakdown</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={fraudDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {fraudDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {fraudDistribution.map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                      <span className="text-muted-foreground flex-1">{f.name}</span>
                      <span className="font-medium text-foreground">{f.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} custom={5} initial="hidden" animate="visible" className="glass-card p-6">
              <h3 className="font-display font-semibold mb-4 text-foreground">Defense Layers</h3>
              <div className="space-y-3">
                {[
                  { title: "Behavioral Analysis", desc: "Movement patterns, speed anomalies, timing analysis", status: "Active" },
                  { title: "Multi-Signal Verification", desc: "Device fingerprint, IP reputation, session checks", status: "Active" },
                  { title: "Environmental Cross-Check", desc: "Multi-provider weather data validation", status: "Active" },
                  { title: "Graph Pattern Detection", desc: "Linked identities, shared devices, sync patterns", status: "Active" },
                  { title: "Circuit Breaker", desc: "Auto-halt on abnormal payout spikes", status: "Standby" },
                ].map(d => (
                  <div key={d.title} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      d.status === 'Active' ? 'bg-risk-low-bg text-risk-low' : 'bg-risk-medium-bg text-risk-medium'
                    }`}>{d.status}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === "rules" && (
          <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground">Rule Configuration</h3>
              <Button size="sm" variant="outline" className="gap-1"><Settings className="w-3.5 h-3.5" /> Edit Rules</Button>
            </div>
            <div className="space-y-2">
              {ruleConfig.map(r => (
                <div key={r.rule} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.rule}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-foreground">{r.value}</span>
                    <span className="risk-badge-low">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
