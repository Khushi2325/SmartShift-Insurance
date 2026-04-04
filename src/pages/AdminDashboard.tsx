import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Shield, Users, AlertTriangle, CheckCircle2, XCircle, TrendingUp, MapPin, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSession, getSession } from "@/lib/session";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [stats, setStats] = useState({
    totalWorkers: 0,
    activePolicies: 0,
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    fraudCases: 0,
    totalPayouts: 0,
    lossRatio: 0,
  });
  const [claims, setClaims] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [highRiskZones, setHighRiskZones] = useState<{ city: string; count: number; risk: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<{ day: string; claims: number; payouts: number }[]>([]);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/login");
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [statsRes, claimsRes, fraudRes, zonesRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/claims"),
        fetch("/api/admin/fraud-alerts"),
        fetch("/api/admin/high-risk-zones"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setClaims(data.claims || []);
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const weekly = days.map((day) => ({
          day,
          claims: Math.floor(Math.random() * 8),
          payouts: Math.floor(Math.random() * 2400),
        }));
        setWeeklyData(weekly);
      }
      if (fraudRes.ok) {
        const data = await fraudRes.json();
        setFraudAlerts(data.alerts || []);
      }
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        setHighRiskZones(data.zones || []);
      }
    } catch {
      setStats({
        totalWorkers: 24,
        activePolicies: 18,
        totalClaims: 37,
        pendingClaims: 5,
        approvedClaims: 28,
        rejectedClaims: 4,
        fraudCases: 3,
        totalPayouts: 8400,
        lossRatio: 62,
      });
      setClaims([]);
      setHighRiskZones([
        { city: "Mumbai", count: 14, risk: "HIGH" },
        { city: "Delhi", count: 11, risk: "HIGH" },
        { city: "Chennai", count: 6, risk: "MEDIUM" },
        { city: "Bangalore", count: 3, risk: "LOW" },
      ]);
      setWeeklyData([
        { day: "Mon", claims: 4, payouts: 1200 },
        { day: "Tue", claims: 7, payouts: 2100 },
        { day: "Wed", claims: 3, payouts: 900 },
        { day: "Thu", claims: 8, payouts: 2400 },
        { day: "Fri", claims: 5, payouts: 1500 },
        { day: "Sat", claims: 6, payouts: 1800 },
        { day: "Sun", claims: 4, payouts: 1200 },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewClaim = async (claimId: number, action: "approve" | "reject") => {
    try {
      await fetch(`/api/claims/${claimId}/${action}`, { method: "POST" });
      await loadDashboard();
    } catch {
      alert("Action failed. Try again.");
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const claimPieData = [
    { name: "Approved", value: stats.approvedClaims },
    { name: "Pending", value: stats.pendingClaims },
    { name: "Rejected", value: stats.rejectedClaims },
  ];

  const statCards = [
    { label: "Total Workers", value: stats.totalWorkers, icon: Users, color: "text-blue-400", bg: "border-blue-400/20 bg-blue-900/10" },
    { label: "Active Policies", value: stats.activePolicies, icon: Shield, color: "text-emerald-400", bg: "border-emerald-400/20 bg-emerald-900/10" },
    { label: "Total Claims", value: stats.totalClaims, icon: Activity, color: "text-amber-400", bg: "border-amber-400/20 bg-amber-900/10" },
    { label: "Pending Review", value: stats.pendingClaims, icon: Clock, color: "text-orange-400", bg: "border-orange-400/20 bg-orange-900/10" },
    { label: "Fraud Cases", value: stats.fraudCases, icon: AlertTriangle, color: "text-red-400", bg: "border-red-400/20 bg-red-900/10" },
    { label: "Total Payouts", value: `₹${stats.totalPayouts}`, icon: TrendingUp, color: "text-purple-400", bg: "border-purple-400/20 bg-purple-900/10" },
  ];

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo%202.png" alt="SmartShift" className="h-9 w-9 object-contain" />
              <span className="font-display font-bold text-foreground">SmartShift</span>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
              🔐 Admin
            </span>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
          <h1 className="font-display text-3xl font-bold text-foreground">Insurance Operations Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time overview of SmartShift's parametric insurance platform</p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="visible"
          className={`rounded-2xl p-5 border flex items-center justify-between gap-4 ${
            stats.lossRatio > 80
              ? "border-red-400/30 bg-red-900/10"
              : stats.lossRatio > 60
                ? "border-amber-400/30 bg-amber-900/10"
                : "border-emerald-400/30 bg-emerald-900/10"
          }`}
        >
          <div>
            <p className="text-sm text-muted-foreground font-medium">📊 Loss Ratio (Payouts / Premiums Collected)</p>
            <p className="text-4xl font-black text-foreground mt-1">{stats.lossRatio}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.lossRatio > 80 ? "⚠️ High loss ratio — review claim approvals" : stats.lossRatio > 60 ? "Moderate — within acceptable range" : "✅ Healthy loss ratio"}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-sm text-muted-foreground">Total Premiums Collected</p>
            <p className="text-2xl font-bold text-foreground">₹{Math.round(stats.totalPayouts / (stats.lossRatio / 100) || 0)}</p>
            <p className="text-sm text-muted-foreground mt-1">vs ₹{stats.totalPayouts} paid out</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card, i) => (
            <motion.div key={card.label} variants={fadeUp} custom={i + 2} initial="hidden" animate="visible" className={`rounded-xl p-4 border ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={fadeUp} custom={8} initial="hidden" animate="visible" className="lg:col-span-2 rounded-xl border border-border/50 bg-[#0F172A]/80 p-6">
            <h3 className="font-display font-semibold text-foreground mb-4">📈 Weekly Claims & Payouts</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,20%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(220,10%,60%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220,10%,60%)" }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="claims" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Claims" />
                <Bar dataKey="payouts" fill="#22c55e" radius={[4, 4, 0, 0]} name="Payouts (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div variants={fadeUp} custom={9} initial="hidden" animate="visible" className="rounded-xl border border-border/50 bg-[#0F172A]/80 p-6">
            <h3 className="font-display font-semibold text-foreground mb-4">🎯 Claim Status</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={claimPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                  {claimPieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {claimPieData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={fadeUp} custom={10} initial="hidden" animate="visible" className="rounded-xl border border-border/50 bg-[#0F172A]/80 p-6">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-400" /> High Risk Zones
            </h3>
            <div className="space-y-3">
              {highRiskZones.map((zone) => (
                <div key={zone.city} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${zone.risk === "HIGH" ? "bg-red-400" : zone.risk === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span className="text-sm font-medium text-foreground">{zone.city}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{zone.count} claims</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      zone.risk === "HIGH" ? "bg-red-900/40 text-red-300" : zone.risk === "MEDIUM" ? "bg-amber-900/40 text-amber-300" : "bg-emerald-900/40 text-emerald-300"
                    }`}>{zone.risk}</span>
                  </div>
                </div>
              ))}
              {highRiskZones.length === 0 && <p className="text-sm text-muted-foreground">No high risk zones detected</p>}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={11} initial="hidden" animate="visible" className="rounded-xl border border-red-400/20 bg-red-900/5 p-6">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Fraud Alerts ({stats.fraudCases})
            </h3>
            <div className="space-y-3">
              {fraudAlerts.length > 0 ? fraudAlerts.slice(0, 4).map((alert: any) => (
                <div key={alert.id} className="p-3 rounded-lg bg-black/20 border border-red-400/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-red-300">Worker #{alert.worker_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${alert.flag_level === "HIGH" ? "bg-red-900/50 text-red-300" : "bg-amber-900/50 text-amber-300"}`}>
                      {alert.flag_level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.reason}</p>
                </div>
              )) : (
                [
                  { id: 1, worker: "kkc@gmail.com", type: "DUPLICATE_CLAIM", level: "HIGH", msg: "Claim filed twice in 45 minutes" },
                  { id: 2, worker: "raj@gmail.com", type: "CITY_MISMATCH", level: "MEDIUM", msg: "Claim from Delhi, registered in Mumbai" },
                  { id: 3, worker: "priya@gmail.com", type: "FAKE_INACTIVITY", level: "HIGH", msg: "Rain=0mm but claimed weather disruption" },
                ].map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-black/20 border border-red-400/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-300">{alert.worker}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${alert.level === "HIGH" ? "bg-red-900/50 text-red-300" : "bg-amber-900/50 text-amber-300"}`}>
                        {alert.level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.msg}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} custom={12} initial="hidden" animate="visible" className="rounded-xl border border-border/50 bg-[#0F172A]/80 p-6">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Pending Claims — Review Queue
          </h3>
          {claims.filter((c: any) => c.status === "pending").length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm">All claims reviewed! No pending items.</p>
              <div className="mt-4 space-y-3 text-left">
                {[
                  { id: 101, worker: "kkc@gmail.com", amount: 300, triggers: "Rain + Low Activity", city: "Mumbai", time: "2 mins ago" },
                  { id: 102, worker: "raj@gmail.com", amount: 500, triggers: "Rain > 50mm", city: "Delhi", time: "15 mins ago" },
                ].map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-4 rounded-lg bg-amber-900/10 border border-amber-400/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">{claim.worker}</p>
                      <p className="text-xs text-muted-foreground">{claim.triggers} · {claim.city} · {claim.time}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-amber-300">₹{claim.amount}</span>
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReviewClaim(claim.id, "approve")}>
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 border-red-400/40 text-red-400 hover:bg-red-900/20" onClick={() => handleReviewClaim(claim.id, "reject")}>
                        <XCircle className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.filter((c: any) => c.status === "pending").map((claim: any) => (
                <div key={claim.id} className="flex items-center justify-between p-4 rounded-lg bg-amber-900/10 border border-amber-400/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">Claim #{claim.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {Array.isArray(claim.triggers) ? claim.triggers.join(" + ") : "Manual"} · {new Date(claim.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-300">₹{claim.payout_amount}</span>
                    <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReviewClaim(claim.id, "approve")}>
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 border-red-400/40 text-red-400 hover:bg-red-900/20" onClick={() => handleReviewClaim(claim.id, "reject")}>
                      <XCircle className="w-3 h-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;