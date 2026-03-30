import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import WorkerDashboard from "./pages/WorkerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { getSession } from "./lib/session";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
