import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Bell, Brain, Languages, MailOpen, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clearSession, getSession, setSession, UserSession } from "@/lib/session";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserSession | null>(() => getSession());

  if (!user) return <Navigate to="/login" replace />;

  const [settings, setSettings] = useState(user.preferences);

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const next = { ...user, preferences: settings };
    setSession(next);
    setUser(next);
  };

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
              <div className="w-8 h-8 rounded-lg bg-white border border-border/60 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="SmartShift logo" className="h-8 w-8 object-contain" />
              </div>
              <span className="font-display font-bold text-foreground">SmartShift</span>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="glass-card p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure notifications, recommendation behavior, and app preferences.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Bell className="w-4 h-4" /> Alerts
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weather-alerts">Weather Alerts</Label>
                <Switch id="weather-alerts" checked={settings.weatherAlerts} onCheckedChange={(checked) => updateSetting("weatherAlerts", checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="payout-alerts">Payout Alerts</Label>
                <Switch id="payout-alerts" checked={settings.payoutAlerts} onCheckedChange={(checked) => updateSetting("payoutAlerts", checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="shift-reminders">Shift Reminders</Label>
                <Switch id="shift-reminders" checked={settings.shiftReminders} onCheckedChange={(checked) => updateSetting("shiftReminders", checked)} />
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <MailOpen className="w-4 h-4" /> Communication
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="marketing-emails">Marketing Emails</Label>
                <Switch id="marketing-emails" checked={settings.marketingEmails} onCheckedChange={(checked) => updateSetting("marketingEmails", checked)} />
              </div>
              <div className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">
                Transactional messages (critical policy and payment alerts) are always enabled.
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Brain className="w-4 h-4" /> AI Recommendation Mode
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: "balanced", title: "Balanced", desc: "Mix of safety and earnings" },
                  { key: "safety-first", title: "Safety First", desc: "Lower risk windows prioritized" },
                  { key: "earnings-first", title: "Earnings First", desc: "Higher earning potential prioritized" },
                ].map((mode) => {
                  const selected = settings.aiRecommendationMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => updateSetting("aiRecommendationMode", mode.key as UserSession["preferences"]["aiRecommendationMode"])}
                      className={`text-left rounded-md border px-3 py-2 transition-colors ${selected ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted/40"}`}
                    >
                      <p className="text-sm font-medium text-foreground">{mode.title}</p>
                      <p className="text-xs text-muted-foreground">{mode.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Languages className="w-4 h-4" /> App Preferences
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["English", "Hindi"].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => updateSetting("language", lang)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${settings.language === lang ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
                <Clock3 className="w-3.5 h-3.5" /> Timezone follows your browser locale.
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
