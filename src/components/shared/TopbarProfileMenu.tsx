import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface TopbarProfileMenuProps {
  /** Display name — full name or email fallback */
  displayName: string;
  /** 1–2 character initials for the avatar */
  initials: string;
  /** Called when the user confirms logout */
  onLogout: () => void | Promise<void>;
  className?: string;
}

/**
 * TopbarProfileMenu — extracted from AppLayout's inline user dropdown.
 *
 * Preserves all existing auth/logout behavior and navigate-to-settings links
 * exactly as they were. The extraction makes the component reusable across
 * user and admin topbars without duplicating the 50-LOC dropdown block.
 */
export function TopbarProfileMenu({
  displayName,
  initials,
  onLogout,
  className,
}: TopbarProfileMenuProps) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Close on route change — replicated from AppLayout's useEffect
  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await onLogout();
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold select-none">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop — closes menu on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full mt-2 w-52 bg-card rounded-lg shadow-card border p-1.5 z-50 animate-fade-in">
            {/* User info header */}
            <div className="px-3 py-2 mb-1 border-b">
              <p className="text-xs font-medium text-foreground truncate">
                {displayName}
              </p>
            </div>

            {/* Navigation items */}
            <button
              onClick={() => handleNavigate("/app/settings")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
            >
              <User className="w-4 h-4 text-muted-foreground" />
              {t("layout.profile")}
            </button>
            <button
              onClick={() => handleNavigate("/app/settings")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              {t("layout.settings")}
            </button>

            <hr className="my-1 border-border" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left text-destructive"
            >
              <LogOut className="w-4 h-4" />
              {t("auth.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
