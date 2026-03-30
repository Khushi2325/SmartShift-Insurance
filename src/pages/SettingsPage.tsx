import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Bell, Brain, Languages, MailOpen, Clock3, MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clearSession, getSession, setSession, UserSession } from "@/lib/session";
import { applyTheme, t } from "@/lib/preferences";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserSession | null>(() => getSession());

  if (!user) return <Navigate to="/login" replace />;

  const [settings, setSettings] = useState(user.preferences);

  const language = settings.language;

  const persistSettings = (nextSettings: UserSession["preferences"]) => {
    const next = { ...user, preferences: nextSettings };
    setSession(next);
    setUser(next);
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      persistSettings(next);
      if (key === "theme") {
        applyTheme(value as UserSession["preferences"]["theme"]);
      }
      return next;
    });
  };

  const handleSave = () => {
    const next = { ...user, preferences: settings };
    setSession(next);
    setUser(next);
    toast.success(t(language, "saveSuccess"));
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-transparent">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo%202.png" alt="SmartShift logo" className="h-11 w-11 object-contain drop-shadow-sm" />
              <span className="font-display font-bold text-foreground">SmartShift</span>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">{t(language, "settings")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> {t(language, "back")}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>{t(language, "logout")}</Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="glass-card p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t(language, "settings")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t(language, "settingsDesc")}</p>
            <p className="text-xs text-primary mt-2">{t(language, "autoApplyHint")}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Bell className="w-4 h-4" /> {t(language, "alerts")}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weather-alerts">{t(language, "weatherAlerts")}</Label>
                <Switch id="weather-alerts" checked={settings.weatherAlerts} onCheckedChange={(checked) => updateSetting("weatherAlerts", checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="payout-alerts">{t(language, "payoutAlerts")}</Label>
                <Switch id="payout-alerts" checked={settings.payoutAlerts} onCheckedChange={(checked) => updateSetting("payoutAlerts", checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="shift-reminders">{t(language, "shiftReminders")}</Label>
                <Switch id="shift-reminders" checked={settings.shiftReminders} onCheckedChange={(checked) => updateSetting("shiftReminders", checked)} />
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <MailOpen className="w-4 h-4" /> {t(language, "communication")}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="marketing-emails">{t(language, "marketingEmails")}</Label>
                <Switch id="marketing-emails" checked={settings.marketingEmails} onCheckedChange={(checked) => updateSetting("marketingEmails", checked)} />
              </div>
              <div className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">
                {t(language, "transactionalHint")}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-4 bg-card/50">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Brain className="w-4 h-4" /> {t(language, "aiRecommendationMode")}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: "balanced", title: t(language, "balanced"), desc: t(language, "modeBalancedDesc") },
                  { key: "safety-first", title: t(language, "safetyFirst"), desc: t(language, "modeSafetyDesc") },
                  { key: "earnings-first", title: t(language, "earningsFirst"), desc: t(language, "modeEarningsDesc") },
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
                <Languages className="w-4 h-4" /> {t(language, "appPreferences")}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(language, "language")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {["English", "Hindi"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => updateSetting("language", lang as UserSession["preferences"]["language"])}
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${settings.language === lang ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(language, "theme")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSetting("theme", "dark")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 ${settings.theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                  >
                    <MoonStar className="h-4 w-4" /> {t(language, "darkTheme")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting("theme", "light")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 ${settings.theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-foreground"}`}
                  >
                    <Sun className="h-4 w-4" /> {t(language, "lightTheme")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
                <Clock3 className="w-3.5 h-3.5" /> {t(language, "timezoneHint")}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleSave}>
              <Save className="w-4 h-4" /> {t(language, "saveSettings")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
