import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Mail, MapPin, Phone, Bike, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearSession, getSession, setSession, UserSession } from "@/lib/session";
import { tx, useAppLanguage } from "@/lib/preferences";
import { toast } from "sonner";

const ProfilePage = () => {
  const navigate = useNavigate();
  const language = useAppLanguage();
  const [user, setUser] = useState<UserSession | null>(() => getSession());

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    city: user?.city || "",
    phone: user?.phone || "",
    vehicleType: user?.vehicleType || "",
    emergencyContact: user?.emergencyContact || "",
  });

  if (!user) return <Navigate to="/login" replace />;

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const next: UserSession = {
      ...user,
      name: form.name.trim() || user.name,
      email: form.email.trim() || user.email,
      city: form.city.trim() || user.city,
      phone: form.phone.trim(),
      vehicleType: form.vehicleType.trim(),
      emergencyContact: form.emergencyContact.trim(),
    };

    setSession(next);
    setUser(next);
    toast.success(tx(language, "Profile updated successfully.", "प्रोफाइल सफलतापूर्वक अपडेट हुई।"));
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
            <span className="text-sm text-muted-foreground hidden md:block">{tx(language, "Profile", "प्रोफाइल")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> {tx(language, "Back", "वापस")}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>{tx(language, "Logout", "लॉगआउट")}</Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="glass-card p-6 max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">{tx(language, "My Profile", "मेरी प्रोफाइल")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tx(language, "Update your details below. Password changes are intentionally disabled here for security.", "नीचे अपनी जानकारी अपडेट करें। सुरक्षा के लिए यहां पासवर्ड बदलना बंद रखा गया है।")}
            </p>
          </div>

          <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "Full Name", "पूरा नाम")}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "Email", "ईमेल")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "City", "शहर")}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "Phone", "फोन")}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="pl-10" placeholder={tx(language, "+91 98xxxxxx", "+91 98xxxxxx")} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "Vehicle Type", "वाहन प्रकार")}</label>
              <div className="relative">
                <Bike className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.vehicleType} onChange={(e) => updateField("vehicleType", e.target.value)} className="pl-10" placeholder={tx(language, "Bike / Scooter / Car", "बाइक / स्कूटर / कार")} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx(language, "Emergency Contact", "आपातकालीन संपर्क")}</label>
              <div className="relative">
                <Contact className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={form.emergencyContact} onChange={(e) => updateField("emergencyContact", e.target.value)} className="pl-10" placeholder={tx(language, "Name + Phone", "नाम + फोन")} />
              </div>
            </div>

            <div className="md:col-span-2 rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
              {tx(language, "Password is not editable from this page.", "इस पेज से पासवर्ड एडिट नहीं किया जा सकता।")}
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" className="gap-2">
                <Save className="w-4 h-4" /> {tx(language, "Save Profile", "प्रोफाइल सेव करें")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
