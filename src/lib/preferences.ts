import { getSession, ThemeMode, AppLanguage } from "@/lib/session";
import { SESSION_UPDATED_EVENT } from "@/lib/session";
import { useEffect, useState } from "react";

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.classList.toggle("light-theme", theme === "light");
};

export const getCurrentTheme = (): ThemeMode => {
  const session = getSession();
  return session?.preferences?.theme === "light" ? "light" : "dark";
};

export const getCurrentLanguage = (): AppLanguage => {
  const session = getSession();
  return session?.preferences?.language === "Hindi" ? "Hindi" : "English";
};

const dictionary = {
  English: {
    settings: "Settings",
    back: "Back",
    logout: "Logout",
    saveSettings: "Save Settings",
    alerts: "Alerts",
    weatherAlerts: "Weather Alerts",
    payoutAlerts: "Payout Alerts",
    shiftReminders: "Shift Reminders",
    communication: "Communication",
    marketingEmails: "Marketing Emails",
    appPreferences: "App Preferences",
    aiRecommendationMode: "AI Recommendation Mode",
    balanced: "Balanced",
    safetyFirst: "Safety First",
    earningsFirst: "Earnings First",
    language: "Language",
    theme: "Theme",
    darkTheme: "Dark",
    lightTheme: "Light",
    settingsDesc: "Configure notifications, recommendation behavior, and app preferences.",
    timezoneHint: "Timezone follows your browser locale.",
    saveSuccess: "Settings updated successfully.",
    autoApplyHint: "Language and theme apply instantly.",
    transactionalHint: "Transactional messages (critical policy and payment alerts) are always enabled.",
    modeBalancedDesc: "Mix of safety and earnings",
    modeSafetyDesc: "Lower risk windows prioritized",
    modeEarningsDesc: "Higher earning potential prioritized",
  },
  Hindi: {
    settings: "सेटिंग्स",
    back: "वापस",
    logout: "लॉगआउट",
    saveSettings: "सेटिंग्स सेव करें",
    alerts: "अलर्ट",
    weatherAlerts: "मौसम अलर्ट",
    payoutAlerts: "पेआउट अलर्ट",
    shiftReminders: "शिफ्ट रिमाइंडर",
    communication: "संचार",
    marketingEmails: "मार्केटिंग ईमेल",
    appPreferences: "ऐप प्राथमिकताएं",
    aiRecommendationMode: "एआई सिफारिश मोड",
    balanced: "संतुलित",
    safetyFirst: "सुरक्षा पहले",
    earningsFirst: "कमाई पहले",
    language: "भाषा",
    theme: "थीम",
    darkTheme: "डार्क",
    lightTheme: "लाइट",
    settingsDesc: "नोटिफिकेशन, सिफारिश मोड और ऐप प्राथमिकताएं सेट करें।",
    timezoneHint: "टाइमज़ोन आपके ब्राउज़र लोकल के अनुसार है।",
    saveSuccess: "सेटिंग्स सफलतापूर्वक अपडेट हो गईं।",
    autoApplyHint: "भाषा और थीम तुरंत लागू होती हैं।",
    transactionalHint: "ट्रांजेक्शन संदेश (महत्वपूर्ण पॉलिसी और पेमेंट अलर्ट) हमेशा चालू रहते हैं।",
    modeBalancedDesc: "सुरक्षा और कमाई का संतुलित मिश्रण",
    modeSafetyDesc: "कम जोखिम वाले समय को प्राथमिकता",
    modeEarningsDesc: "उच्च कमाई की संभावना को प्राथमिकता",
  },
} as const;

export const t = (language: AppLanguage, key: keyof typeof dictionary.English): string => {
  return dictionary[language][key] || dictionary.English[key];
};

export const tx = (language: AppLanguage, english: string, hindi: string): string => {
  return language === "Hindi" ? hindi : english;
};

export const useAppLanguage = (): AppLanguage => {
  const [language, setLanguage] = useState<AppLanguage>(() => getCurrentLanguage());

  useEffect(() => {
    const syncLanguage = () => setLanguage(getCurrentLanguage());

    window.addEventListener("storage", syncLanguage);
    window.addEventListener(SESSION_UPDATED_EVENT, syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncLanguage);
    };
  }, []);

  return language;
};
