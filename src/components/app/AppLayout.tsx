import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  List,
  FileDown,
  CreditCard,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  LayoutDashboard
} from "lucide-react";

import { TopbarProfileMenu } from "@/components/shared/TopbarProfileMenu";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getCredits } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useTranslation } from "react-i18next";

const SIDEBAR_COLLAPSED_KEY = "sidebar:collapsed";

const sidebarItems = [
  { icon: LayoutDashboard, label: "layout.dashboard", path: "/app/dashboard" },
  { icon: Search, label: "layout.search", path: "/app/search" },
  { icon: Clock, label: "layout.searchHistory", path: "/app/history" },
  { icon: List, label: "layout.leadLists", path: "/app/lists" },
  { icon: FileDown, label: "layout.exports", path: "/app/exports" },
  { icon: CreditCard, label: "layout.billing", path: "/app/billing" },
  { icon: Settings, label: "layout.settings", path: "/app/settings" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, profile: authProfile, refreshProfile, credits: contextCredits, setCredits } = useAuth();
  const { t, i18n } = useTranslation();

  const toggleCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

  // Fetch profile and credits from backend
  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!user,
    // Disable automatic focus/reconnect refetch: these background queries
    // fire concurrent getSession() calls that race with load-more and other
    // user-triggered requests, stalling the auth pipeline. Explicit
    // invalidation (refreshProfile, queryClient.invalidateQueries) still works.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: creditsData } = useQuery({
    queryKey: QUERY_KEYS.credits,
    queryFn: getCredits,
    enabled: !!user,
    // refetchInterval removed: the 30s timer was firing getSession() concurrently
    // with load-more and other user-triggered requests, stalling the auth pipeline.
    // Credits stay accurate via explicit queryClient.invalidateQueries(QUERY_KEYS.credits)
    // after every action that changes the balance (search, load-more, enrich, purchase).
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const profile = profileData?.profile;
  const credits = contextCredits ?? creditsData?.credits ?? 0;

  // Sync credits from backend to context ONLY on initial load (contextCredits === null).
  // After that, contextCredits is the single source of truth — refreshProfile() updates it
  // directly. Never overwrite a fresh value with a stale React Query cache result.
  useEffect(() => {
    if (creditsData?.credits !== undefined && contextCredits === null) {
      setCredits(creditsData.credits);
    }
  }, [creditsData?.credits]);



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
    <div className="h-screen overflow-hidden bg-muted/30 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r transform transition-[width,transform] duration-200 lg:static lg:inset-auto lg:translate-x-0 lg:h-full lg:flex-shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`border-b flex items-center ${sidebarCollapsed ? "p-3 lg:justify-center" : "p-6"}`}>
            <NavLink to="/" className="text-2xl font-bold">
              <span className="text-sidebar-primary">Lead</span>
              <span className={`text-sidebar-foreground ${sidebarCollapsed ? "lg:hidden" : ""}`}>Hunter</span>
            </NavLink>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => {
              const isActive = currentPath.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  aria-label={sidebarCollapsed ? t(item.label) : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""} ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={sidebarCollapsed ? "lg:hidden" : ""}>{t(item.label)}</span>
                </NavLink>
              );
            })}

            {/* Admin Panel (conditional) */}
            {authProfile?.role === 'admin' && (
              <NavLink
                to="/app/admin"
                onClick={() => setSidebarOpen(false)}
                aria-label={sidebarCollapsed ? t("layout.adminPanel") : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""} ${currentPath.startsWith('/app/admin')
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <Shield className="w-5 h-5 flex-shrink-0" />
                <span className={sidebarCollapsed ? "lg:hidden" : ""}>Admin Panel</span>
              </NavLink>
            )}
          </nav>

          {/* Collapse toggle - desktop only */}
          <div className="hidden lg:block border-t p-2">
            <button
              onClick={toggleCollapsed}
              aria-label={sidebarCollapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
              title={sidebarCollapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
              className={`flex items-center w-full p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${sidebarCollapsed ? "justify-center" : "gap-2"}`}
            >
              {sidebarCollapsed
                ? <ChevronRight className="w-4 h-4" />
                : <><ChevronLeft className="w-4 h-4" /><span className="text-xs text-sidebar-foreground/60">{t("layout.collapse")}</span></>
              }
            </button>
          </div>
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
      <div className="flex-1 flex flex-col min-h-0">
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
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
            {/* Language selector */}
            <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
              <SelectTrigger className="w-20 h-9 bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tr">TR</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>

            {/* User menu — extracted to TopbarProfileMenu */}
            <TopbarProfileMenu
              displayName={displayName}
              initials={initials}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
