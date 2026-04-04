import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AnimatedBackground from "./components/AnimatedBackground";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import WorkerDashboard from "./pages/WorkerDashboard";
import NotFound from "./pages/NotFound";
import { getSession } from "./lib/session";
import { SESSION_UPDATED_EVENT } from "./lib/session";
import { applyTheme, getCurrentTheme } from "./lib/preferences";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

const queryClient = new QueryClient();

const ProtectedWorkerRoute = ({ children }: { children: JSX.Element }) => {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return children;
};

const ProtectedAdminRoute = ({ children }: { children: JSX.Element }) => {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.94 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedWorkerRoute>
                <WorkerDashboard />
              </ProtectedWorkerRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedWorkerRoute>
                <ProfilePage />
              </ProtectedWorkerRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedWorkerRoute>
                <SettingsPage />
              </ProtectedWorkerRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => {
  useEffect(() => {
    applyTheme(getCurrentTheme());

    const onStorage = () => applyTheme(getCurrentTheme());
    const onSessionUpdate = () => applyTheme(getCurrentTheme());
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_UPDATED_EVENT, onSessionUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_UPDATED_EVENT, onSessionUpdate);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AnimatedBackground />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
