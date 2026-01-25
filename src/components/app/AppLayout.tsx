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
  User
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  { icon: Search, label: "Arama", path: "/app/search" },
  { icon: List, label: "Lead Listeleri", path: "/app/lists" },
  { icon: FileDown, label: "CSV Exportlar", path: "/app/exports" },
  { icon: CreditCard, label: "Faturalandırma", path: "/app/billing" },
  { icon: Settings, label: "Ayarlar", path: "/app/settings" },
];

const pageTitles: Record<string, string> = {
  "/app/search": "İşletme Ara",
  "/app/lists": "Lead Listeleri",
  "/app/exports": "CSV Exportlar",
  "/app/billing": "Faturalandırma",
  "/app/settings": "Ayarlar",
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || "Dashboard";

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r transform transition-transform duration-200 lg:translate-x-0 lg:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Credits badge */}
          <div className="p-4 border-t">
            <div className="bg-sidebar-accent rounded-lg p-4">
              <p className="text-xs text-sidebar-foreground/70 mb-1">Kalan Kredi</p>
              <p className="text-2xl font-bold text-sidebar-primary">1.250</p>
              <Button size="sm" variant="outline" className="w-full mt-3 text-xs">
                Kredi Satın Al
              </Button>
            </div>
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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b h-16 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 -ml-2 mr-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <h1 className="text-xl font-semibold">{pageTitle}</h1>

          <div className="ml-auto flex items-center gap-4">
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                  AY
                </div>
                <span className="hidden sm:block text-sm font-medium">Ahmet Yılmaz</span>
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
                      Profil
                    </NavLink>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted w-full text-left text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      Çıkış Yap
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
