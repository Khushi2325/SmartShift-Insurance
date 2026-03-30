import { motion } from "framer-motion";
import { Shield, Zap, Brain, CloudRain, Wind, Thermometer, ArrowRight, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getSession } from "@/lib/session";
import { tx, useAppLanguage } from "@/lib/preferences";

const fadeUp = {
  hidden: { opacity: 0, y: 40, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1 },
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

const featureHindi: Record<string, { title: string; desc: string }> = {
  "AI Risk Prediction": { title: "AI जोखिम पूर्वानुमान", desc: "मौसम, AQI और पर्यावरण संकेतों से रियल-टाइम जोखिम स्कोरिंग।" },
  "Instant Payouts": { title: "तुरंत पेआउट", desc: "ट्रिगर कंडीशन पूरी होते ही पेआउट ऑटो-प्रोसेस होता है।" },
  "Fraud Protection": { title: "फ्रॉड सुरक्षा", desc: "व्यवहार विश्लेषण और मल्टी-सिग्नल वेरिफिकेशन से मजबूत सुरक्षा।" },
  "Smart Shifts": { title: "स्मार्ट शिफ्ट्स", desc: "कम जोखिम और बेहतर कमाई के लिए AI सुझाए सुरक्षित समय।" },
};

const stepHindi: Record<string, { title: string; desc: string }> = {
  "Sign Up & Select City": { title: "साइन अप करें और शहर चुनें", desc: "रजिस्टर करें और अपना कार्य शहर व प्राथमिकताएं चुनें।" },
  "Get Risk Assessment": { title: "जोखिम मूल्यांकन पाएं", desc: "AI मौसम और AQI देखकर आपका जोखिम स्कोर बनाता है।" },
  "Activate Coverage": { title: "कवरेज सक्रिय करें", desc: "डायनैमिक प्रीमियम देकर अपनी शिफ्ट सुरक्षा सक्रिय करें।" },
  "Auto-Protected": { title: "ऑटो-सुरक्षित", desc: "शर्त पूरी होने पर पेआउट अपने आप ट्रिगर होता है।" },
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

      {/* Hero Section - Logo-First Design */}
      <section className="relative pt-6 pb-10 px-4 min-h-[88vh] flex flex-col items-center justify-center">
        <div className="container mx-auto max-w-6xl flex flex-col items-center justify-center">
          {/* LARGE CENTERED LOGO - Main Hero Element */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative mb-0 z-10"
          >
            {/* Glow aura - larger and more pronounced */}
            <div className="absolute inset-0 rounded-full" 
              style={{
                background: "radial-gradient(circle, rgba(37, 99, 235, 0.5), rgba(99, 102, 241, 0.2), transparent)",
                width: "450px",
                height: "450px",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                filter: "blur(80px)",
                zIndex: -1,
              }}
            />
            
            {/* Animated glow pulse */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(37, 99, 235, 0.3), transparent 70%)",
                width: "380px",
                height: "380px",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                filter: "blur(60px)",
              }}
            />

            {/* Logo */}
            <motion.img
              src="/logo%202.png"
              alt="SmartShift Insurance"
              className="h-[24rem] w-[24rem] md:h-[30rem] md:w-[30rem] object-contain relative z-10 drop-shadow-2xl -mb-16 md:-mb-24"
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                filter: "drop-shadow(0 0 60px rgba(37, 99, 235, 0.8)) drop-shadow(0 0 100px rgba(99, 102, 241, 0.4))",
              }}
            />
          </motion.div>

          {/* SMALLER TEXT - Secondary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mb-5 max-w-3xl -mt-2 md:-mt-4"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40 backdrop-blur-md mb-3">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">{tx(language, "AI-Powered Parametric Insurance", "AI-संचालित पैरामीट्रिक बीमा")}</span>
            </div>

            {/* Heading - Reduced size */}
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight text-white mb-3">
              {tx(language, "Protect Your Income,", "अपनी आय सुरक्षित रखें,")}
            </h1>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
              {tx(language, "Automatically", "अपने आप")}
            </h1>

            {/* Description - Smaller size */}
            <p className="text-gray-300 text-base md:text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
              {tx(language, "SmartShift monitors weather, air quality, and environmental conditions and pays you instantly when disruptions prevent you from working.", "SmartShift मौसम, हवा की गुणवत्ता और पर्यावरण की स्थिति को मॉनिटर करता है और रुकावट होने पर तुरंत भुगतान करता है।")}
            </p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center justify-center gap-3 flex-wrap"
            >
              <Link to={session ? dashboardPath : "/register"}>
                <Button
                  size="lg"
                  className="gap-2 px-6 h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transition-all duration-300"
                >
                  {session ? tx(language, "Open Dashboard", "डैशबोर्ड खोलें") : tx(language, "Start Protection", "सुरक्षा शुरू करें")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to={dashboardPath}>
                <Button
                  variant="outline"
                  size="lg"
                  className="px-6 h-11 border-blue-500/50 text-blue-300 hover:bg-blue-500/10 font-semibold rounded-lg transition-all duration-300"
                >
                  {tx(language, "View Demo", "डेमो देखें")}
                </Button>
              </Link>
            </motion.div>
          </motion.div>
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
            <p className="text-gray-400 max-w-xl mx-auto">{tx(language, "Four intelligent layers working together to keep gig workers financially safe.", "चार स्मार्ट लेयर्स मिलकर गिग वर्कर्स को आर्थिक रूप से सुरक्षित रखते हैं।")}</p>
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
            <p className="text-gray-400 mb-8 text-lg">{tx(language, "Join thousands of gig workers who never worry about weather disruptions again.", "हज़ारों गिग वर्कर्स से जुड़ें जो अब मौसम रुकावटों की चिंता नहीं करते।")}</p>
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
