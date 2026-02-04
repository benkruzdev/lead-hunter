import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  List,
  FileDown,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Globe,
  Shield,
  Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getCredits } from "@/lib/api";
import { useTranslation } from "react-i18next";

const sidebarItems = [
  { icon: Search, label: "layout.search", path: "/app/search" },
  { icon: Clock, label: "layout.searchHistory", path: "/app/history" },
  { icon: List, label: "layout.leadLists", path: "/app/lists" },
  { icon: FileDown, label: "layout.exports", path: "/app/exports" },
  { icon: CreditCard, label: "layout.billing", path: "/app/billing" },
  { icon: Settings, label: "layout.settings", path: "/app/settings" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, profile: authProfile, refreshProfile, credits: contextCredits, setCredits } = useAuth();
  const { t, i18n } = useTranslation();

  // Fetch profile and credits from backend
  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!user,
  });

  const { data: creditsData } = useQuery({
    queryKey: ["credits"],
    queryFn: getCredits,
    enabled: !!user,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const profile = profileData?.profile;
  const credits = contextCredits ?? creditsData?.credits ?? 0;

  // Sync credits from backend to context
  useEffect(() => {
    if (creditsData?.credits !== undefined && creditsData.credits !== contextCredits) {
      setCredits(creditsData.credits);
    }
  }, [creditsData?.credits, contextCredits, setCredits]);

  // Get display name (full_name or email)
  const displayName = profile?.full_name || profile?.email || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const currentPath = location.pathname;
  const pageTitle = sidebarItems.find((item) => currentPath.startsWith(item.path))?.label || "Dashboard";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "tr" ? "en" : "tr";
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r transform transition-transform duration-200 lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <NavLink to="/" className="text-2xl font-bold">
              <span className="text-sidebar-primary">Lead</span>
              <span className="text-sidebar-foreground">Hunter</span>
            </NavLink>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item) => {
              const isActive = currentPath.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  {t(item.label)}
                </NavLink>
              );
            })}

            {/* Admin Panel (conditional) */}
            {authProfile?.role === 'admin' && (
              <NavLink
                to="/app/admin"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentPath.startsWith('/app/admin')
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
              >
                <Shield className="w-5 h-5" />
                Admin Panel
              </NavLink>
            )}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b h-16 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 -ml-2 mr-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <h1 className="text-xl font-semibold">{t(pageTitle)}</h1>

          <div className="ml-auto flex items-center gap-4">
            {/* Credit display */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <span className="text-sm font-medium">{t("common.creditsRemaining")}:</span>
              <span className="text-sm font-bold text-primary">{credits.toLocaleString()}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-2 h-7 text-xs"
                onClick={() => navigate("/app/billing")}
              >
                {t("layout.buyCredits")}
              </Button>
            </div>
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                  {initials}
                </div>
                <span className="hidden sm:block text-sm font-medium">{displayName}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card rounded-lg shadow-card border p-2 z-50 animate-fade-in">
                    <NavLink
                      to="/app/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted"
                    >
                      <User className="w-4 h-4" />
                      {t("layout.profile")}
                    </NavLink>
                    <button
                      onClick={() => {
                        toggleLanguage();
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left"
                    >
                      <Globe className="w-4 h-4" />
                      {i18n.language === "tr" ? "English" : "Türkçe"}
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await handleLogout();
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("auth.logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

