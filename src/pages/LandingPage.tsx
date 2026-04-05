import { motion } from "framer-motion";
import { Shield, Zap, Brain, CloudRain, ArrowRight, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getSession } from "@/lib/session";
import { tx, useAppLanguage } from "@/lib/preferences";

const fadeUp = {
  hidden: { opacity: 0, y: 40, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const features = [
  { icon: Brain, title: "AI Risk Assessment", desc: "Dynamic Low/Medium/High risk scoring from weather, AQI, and disruption history." },
  { icon: Zap, title: "Automatic Claim Trigger", desc: "When disruption thresholds and low activity are detected, claims are auto-created instantly." },
  { icon: Shield, title: "Fraud Protection", desc: "GPS consistency, anomaly checks, duplicate-claim controls, and behavior-based verification." },
  { icon: BarChart3, title: "Weekly Pricing Model", desc: "Affordable weekly plans aligned with gig-worker earning cycles and risk levels." },
];

const steps = [
  { num: "01", title: "Sign Up & Select City", desc: "Register and choose your working city and preferences." },
  { num: "02", title: "Get Risk Assessment", desc: "AI evaluates weather, AQI, location pattern, and disruption history." },
  { num: "03", title: "Activate Weekly Plan", desc: "Choose Low, Medium, or High risk plan based on your earning dependency." },
  { num: "04", title: "Auto Credit Payout", desc: "If threshold breach + reduced activity is detected, payout is credited to wallet automatically." },
];

const featureHindi: Record<string, { title: string; desc: string }> = {
  "AI Risk Assessment": { title: "AI जोखिम आकलन", desc: "मौसम, AQI और इतिहास से लो/मीडियम/हाई जोखिम स्कोरिंग।" },
  "Automatic Claim Trigger": { title: "ऑटोमैटिक क्लेम ट्रिगर", desc: "थ्रेशहोल्ड और कम गतिविधि मिलते ही क्लेम अपने आप शुरू हो जाता है।" },
  "Fraud Protection": { title: "फ्रॉड सुरक्षा", desc: "व्यवहार विश्लेषण और मल्टी-सिग्नल वेरिफिकेशन से मजबूत सुरक्षा।" },
  "Weekly Pricing Model": { title: "साप्ताहिक प्राइसिंग मॉडल", desc: "गिग वर्कर्स के कमाई चक्र के अनुसार किफायती साप्ताहिक प्लान।" },
};

const stepHindi: Record<string, { title: string; desc: string }> = {
  "Sign Up & Select City": { title: "साइन अप करें और शहर चुनें", desc: "रजिस्टर करें और अपना कार्य शहर व प्राथमिकताएं चुनें।" },
  "Get Risk Assessment": { title: "जोखिम मूल्यांकन पाएं", desc: "AI मौसम, AQI और ट्रेंड देखकर आपका जोखिम स्तर तय करता है।" },
  "Activate Weekly Plan": { title: "साप्ताहिक प्लान सक्रिय करें", desc: "लो, मीडियम या हाई रिस्क प्लान चुनकर कवरेज शुरू करें।" },
  "Auto Credit Payout": { title: "ऑटो पेआउट क्रेडिट", desc: "शर्त पूरी होते ही पेआउट अपने आप वॉलेट में क्रेडिट होता है।" },
};

const LandingPage = () => {
  const language = useAppLanguage();
  const session = getSession();
  const dashboardPath = session?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="landing-page min-h-screen bg-transparent relative overflow-hidden">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo%202.png" alt="SmartShift logo" className="h-8 w-8 object-contain drop-shadow-sm" />
            <span className="font-display font-bold text-base text-foreground hidden sm:inline">SmartShift</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {session ? (
              <>
                <span className="hidden md:block text-xs text-muted-foreground">Hi, {session.name}</span>
                <Link to={dashboardPath}>
                  <Button variant="outline" size="sm" className="text-xs h-8">{tx(language, "Dashboard", "डैशबोर्ड")}</Button>
                </Link>
                <Link to="/profile">
                  <Button size="sm" className="text-xs h-8">{tx(language, "Profile", "प्रोफाइल")}</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-xs h-8">{tx(language, "Log in", "लॉग इन")}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="text-xs h-8">{tx(language, "Get Started", "शुरू करें")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 min-h-[78vh] flex items-center">
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/40 bg-blue-500/10 text-blue-200 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              AI-powered weather risk protection
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              SmartShift Insurance
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl">
              Proactive parametric insurance for delivery riders who depend on consistent daily earnings.
            </p>
            <p className="text-sm text-gray-400 max-w-xl">
              Example persona: Rahul (Ahmedabad), earning ₹800–₹1200/day and ₹6000–₹8000/week.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-cyan-100 text-sm font-medium shadow-[0_0_28px_rgba(34,211,238,0.18)]">
              <CloudRain className="w-4 h-4" /> "One disruption day can cause 15%–25% weekly income loss"
            </div>
            <p className="text-xs text-cyan-100/90 font-medium">💡 SmartShift auto-detects disruption and credits payout instantly</p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link to={session ? dashboardPath : "/register"}>
                <Button size="lg" className="gap-2 px-6 h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg">
                  {session ? tx(language, "Open Dashboard", "डैशबोर्ड खोलें") : tx(language, "Start Protection Now", "अभी सुरक्षा शुरू करें")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to={dashboardPath}>
                <Button variant="outline" size="lg" className="px-6 h-11 border-blue-500/50 text-blue-300 hover:bg-blue-500/10 font-semibold rounded-lg">
                  {tx(language, "View Demo", "डेमो देखें")}
                </Button>
              </Link>
            </div>
            <p className="text-xs text-gray-300">Built for Zomato and Swiggy riders in urban high-risk zones</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.35),rgba(8,47,73,0.05),transparent)] blur-2xl" />
            <img src="/logo%202.png" alt="SmartShift Insurance" className="h-72 w-72 md:h-96 md:w-96 object-contain drop-shadow-2xl" />
          </motion.div>
        </div>
      </section>

      {/* Who Is This For */}
      <section className="py-14 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-blue-500/20 bg-slate-900/35 p-6 md:p-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">Who is this for?</h2>
            <p className="text-sm text-gray-400 mb-5">Urban food-delivery riders fully dependent on daily working hours for weekly income stability.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                <span>Daily earnings typically range between ₹800 and ₹1200</span>
              </div>
              <div className="flex items-center gap-3 text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                <span>Weekly earnings usually range between ₹6000 and ₹8000</span>
              </div>
              <div className="flex items-center gap-3 text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                <span>Even one disruption day can reduce weekly income by 15%–25%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">Weekly Pricing Model</h2>
            <p className="text-sm text-gray-400">Affordable weekly plans aligned with gig-worker earning cycles.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { risk: "Low Risk", premium: "₹49/week", coverage: "Up to ₹800" },
              { risk: "Medium Risk", premium: "₹79/week", coverage: "Up to ₹1200" },
              { risk: "High Risk", premium: "₹109/week", coverage: "Up to ₹1600" },
            ].map((item) => (
              <div key={item.risk} className="rounded-xl border border-blue-500/20 bg-slate-900/40 p-5">
                <p className="text-xs uppercase tracking-wide text-blue-200/80">{item.risk}</p>
                <p className="mt-2 text-2xl font-bold text-white">{item.premium}</p>
                <p className="mt-1 text-sm text-gray-300">{item.coverage}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">Parametric Trigger System</h2>
            <p className="text-sm text-gray-400">Claims trigger automatically when threshold breach is detected with low activity.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-cyan-500/25 bg-slate-900/40 p-5 text-sm text-gray-200">🌧 Heavy Rain: Rainfall &gt; 20 mm/hr</div>
            <div className="rounded-xl border border-cyan-500/25 bg-slate-900/40 p-5 text-sm text-gray-200">🌡 Heatwave: Temperature &gt; 40°C</div>
            <div className="rounded-xl border border-cyan-500/25 bg-slate-900/40 p-5 text-sm text-gray-200">🌫 Pollution: AQI &gt; 300</div>
            <div className="rounded-xl border border-cyan-500/25 bg-slate-900/40 p-5 text-sm text-gray-200">🌊 Flood Risk: Rainfall &gt; 100 mm/day</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{tx(language, "How SmartShift Protects You", "SmartShift आपको कैसे सुरक्षित रखता है")}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{tx(language, "Four intelligent layers working together to protect riders in rain-heavy cities.", "चार स्मार्ट लेयर्स मिलकर बारिश-प्रभावित शहरों के राइडर्स को आर्थिक रूप से सुरक्षित रखते हैं।")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group p-6 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-blue-500/20 backdrop-blur-md hover:border-blue-400/40 hover:bg-blue-500/5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                  <f.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-2">{tx(language, f.title, featureHindi[f.title]?.title || f.title)}</h3>
                <p className="text-sm text-gray-400">{tx(language, f.desc, featureHindi[f.title]?.desc || f.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{tx(language, "Simple. Automatic. Fair.", "सरल। ऑटोमेटिक। निष्पक्ष।")}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{tx(language, "From signup to payout in four steps - no paperwork, no hassle.", "साइनअप से भुगतान तक सिर्फ चार स्टेप - बिना कागज़ी झंझट।")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="p-6 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-blue-500/20"
              >
                <span className="text-4xl font-display font-bold text-blue-500/20 block mb-2">{s.num}</span>
                <h3 className="font-display font-semibold text-lg text-white mb-2">{tx(language, s.title, stepHindi[s.title]?.title || s.title)}</h3>
                <p className="text-sm text-gray-400">{tx(language, s.desc, stepHindi[s.title]?.desc || s.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Traditional vs SmartShift */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">{tx(language, "Why Parametric?", "पैरामीट्रिक क्यों?")}</h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-blue-500/20 overflow-hidden"
          >
            <div className="grid grid-cols-3 font-display font-semibold text-sm border-b border-blue-500/10 bg-blue-500/5">
              <div className="p-4"></div>
              <div className="p-4 text-center text-gray-400">{tx(language, "Traditional", "पारंपरिक")}</div>
              <div className="p-4 text-center text-blue-300 bg-blue-500/10">SmartShift</div>
            </div>
            {[
              [tx(language, "Claim Filing", "क्लेम फाइलिंग"), tx(language, "Manual", "मैनुअल"), tx(language, "Automatic", "ऑटोमेटिक")],
              [tx(language, "Verification", "वेरिफिकेशन"), tx(language, "Days/Weeks", "दिन/हफ्ते"), tx(language, "Real-time", "रियल-टाइम")],
              [tx(language, "Process", "प्रक्रिया"), tx(language, "Human-heavy", "मानव-आधारित"), tx(language, "AI-driven", "AI-संचालित")],
              [tx(language, "Payout Speed", "भुगतान गति"), tx(language, "Slow", "धीमा"), tx(language, "Instant", "तुरंत")],
              [tx(language, "Fraud Prevention", "धोखाधड़ी सुरक्षा"), tx(language, "Reactive", "रिएक्टिव"), tx(language, "Proactive", "प्रोएक्टिव")],
            ].map(([label, trad, smart]) => (
              <div key={label} className="grid grid-cols-3 text-sm border-b border-blue-500/10 last:border-0">
                <div className="p-4 font-medium text-white">{label}</div>
                <div className="p-4 text-center text-gray-400">{trad}</div>
                <div className="p-4 text-center text-blue-300 bg-blue-500/5 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {smart}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{tx(language, "Ready to Protect Your Earnings?", "क्या आप अपनी कमाई सुरक्षित करने के लिए तैयार हैं?")}</h2>
            <p className="text-gray-400 mb-8 text-lg">{tx(language, "Built for workers affected by weather disruptions in cities like Mumbai.", "मुंबई जैसे शहरों में मौसम रुकावटों से प्रभावित कामगारों के लिए बनाया गया।")}</p>
            <Link to={session ? dashboardPath : "/register"}>
              <Button
                size="lg"
                className="gap-2 px-10 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/50"
              >
                {session ? tx(language, "Go To Dashboard", "डैशबोर्ड पर जाएं") : tx(language, "Get Started Free", "मुफ्त में शुरू करें")} <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 bg-background/55 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <img src="/logo%202.png" alt="SmartShift logo" className="h-8 w-8 object-contain" />
            <span className="font-semibold">SmartShift</span>
          </div>
          <p>© 2026 SmartShift. AI-Powered Parametric Insurance.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
