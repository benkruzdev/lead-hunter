import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { useConfig } from "@/contexts/ConfigContext";
import "@/lib/i18n";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/app/AppLayout";
import SearchPage from "./pages/app/SearchPage";
import SearchHistoryPage from "./pages/app/SearchHistoryPage";
import LeadLists from "./pages/app/LeadLists";
import ListDetail from "./pages/app/ListDetail";
import ExportsPage from "./pages/app/ExportsPage";
import BillingPage from "./pages/app/BillingPage";
import SettingsPage from "./pages/app/SettingsPage";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminUserDetailPage from "./pages/admin/AdminUserDetailPage";
import AdminCreditsPage from "./pages/admin/AdminCreditsPage";
import AdminConfigPage from "./pages/admin/AdminConfigPage";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const AppContent = () => {
  const { config, loading } = useConfig();

  // Show loading spinner while fetching config
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Conditionally wrap with reCAPTCHA provider based on backend config
  const appContent = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<Pricing />} />

              {/* App routes (protected) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<AppLayout />}>
                  <Route path="search" element={<SearchPage />} />
                  <Route path="history" element={<SearchHistoryPage />} />
                  <Route path="lists" element={<LeadLists />} />
                  <Route path="lists/:id" element={<ListDetail />} />
                  <Route path="exports" element={<ExportsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="users/:id" element={<AdminUserDetailPage />} />
                    <Route path="credits" element={<AdminCreditsPage />} />
                    <Route path="config" element={<AdminConfigPage />} />
                  </Route>
                </Route>
              </Route>


              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );

  // Wrap with reCAPTCHA provider only if enabled and site key exists
  if (config?.recaptchaEnabled && config?.recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={config.recaptchaSiteKey}>
        {appContent}
      </GoogleReCaptchaProvider>
    );
  }

  return appContent;
};

const App = () => <AppContent />;

export default App;
