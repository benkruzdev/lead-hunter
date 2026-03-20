import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSearchSessions,
  getLeadLists,
  getExports,
  getCredits,
  type SearchSession,
  type LeadList,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Search,
  List,
  FileDown,
  CreditCard,
  Clock,
  ArrowRight,
  Zap,
  ChevronRight,
} from "lucide-react";

type ExportItem = {
  id: string;
  listName: string;
  format: string;
  fileName: string;
  leadCount: number;
  createdAt: string;
};

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile: authProfile, credits: contextCredits } = useAuth();

  const [loading, setLoading] = useState(true);
  const [credits, setCreditsState] = useState<number>(contextCredits ?? 0);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);

  const firstName =
    authProfile?.full_name?.split(" ")[0] ||
    authProfile?.email?.split("@")[0] ||
    "";

  useEffect(() => {
    if (contextCredits !== null && contextCredits !== undefined) {
      setCreditsState(contextCredits);
    }
  }, [contextCredits]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSearchSessions().catch(() => ({ sessions: [] as SearchSession[] })),
      getLeadLists().catch(() => ({ lists: [] as LeadList[] })),
      getExports().catch(() => ({ exports: [] as ExportItem[] })),
      contextCredits == null
        ? getCredits().catch(() => ({ credits: 0 }))
        : Promise.resolve(null),
    ]).then(([sessionsRes, listsRes, exportsRes, creditsRes]) => {
      if (cancelled) return;
      setSessions(sessionsRes.sessions);
      setLists(listsRes.lists);
      setExports(
        (exportsRes.exports ?? []).map((e) => ({
          id: String(e.id ?? ""),
          listName: e.listName ?? "",
          format: e.format ?? "",
          fileName: e.fileName ?? "",
          leadCount: Number(e.leadCount ?? 0),
          createdAt: e.createdAt ?? "",
        }))
      );
      if (creditsRes !== null) setCreditsState(creditsRes.credits);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const sortedExports = [...exports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const cutoff = sevenDaysAgo();
  const searches7d = sessions.filter(
    (s) => new Date(s.created_at) >= cutoff
  ).length;
  const exports7d = exports.filter(
    (e) => new Date(e.createdAt) >= cutoff
  ).length;

  const recentSessions = sortedSessions.slice(0, 3);
  const recentLists = [...lists]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 3);
  const recentExports = sortedExports.slice(0, 3);
  const lastSession = sortedSessions[0] ?? null;

  const stats = [
    {
      label: t("dashboard.creditsRemaining"),
      value: credits.toLocaleString(),
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/20",
    },
    {
      label: t("dashboard.totalSearches"),
      value: sessions.length,
      icon: Search,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      label: t("dashboard.totalLists"),
      value: lists.length,
      icon: List,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
    },
    {
      label: t("dashboard.totalExports"),
      value: exports.length,
      icon: FileDown,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/20",
    },
    {
      label: t("dashboard.searches7d"),
      value: searches7d,
      icon: Clock,
      color: "text-sky-500",
      bg: "bg-sky-50 dark:bg-sky-950/20",
    },
    {
      label: t("dashboard.exports7d"),
      value: exports7d,
      icon: FileDown,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
    },
  ];

  const quickActions = [
    { label: t("dashboard.newSearch"), icon: Search, path: "/app/search" },
    { label: t("layout.searchHistory"), icon: Clock, path: "/app/history" },
    { label: t("layout.leadLists"), icon: List, path: "/app/lists" },
    { label: t("layout.exports"), icon: FileDown, path: "/app/exports" },
    { label: t("layout.buyCredits"), icon: CreditCard, path: "/app/billing" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {firstName
              ? `${t("dashboard.welcome")}, ${firstName}`
              : t("dashboard.welcome")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("dashboard.welcomeDesc")}
          </p>
        </div>
        <Button onClick={() => navigate("/app/search")} className="shrink-0">
          <Search className="w-4 h-4 mr-2" />
          {t("dashboard.newSearch")}
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border rounded-xl p-4 flex flex-col gap-2"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bg}`}
            >
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground leading-tight">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("dashboard.quickActions")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.path}
              variant="outline"
              size="sm"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="w-3.5 h-3.5 mr-1.5" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Continue last search */}
      {lastSession && (
        <div className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {t("dashboard.lastSearch")}
            </div>
            <div className="font-semibold">
              {lastSession.province}
              {lastSession.district ? ` / ${lastSession.district}` : ""} —{" "}
              {lastSession.category}
            </div>
            <div className="text-sm text-muted-foreground">
              {lastSession.total_results} {t("dashboard.results")}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/app/search?sessionId=${lastSession.id}`)
            }
          >
            {t("dashboard.continueSearch")}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent searches */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              {t("dashboard.recentSearches")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/app/history")}
            >
              {t("dashboard.viewAll")}
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          </div>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("dashboard.noSearches")}
            </p>
          ) : (
            <ul className="space-y-1">
              {recentSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() =>
                    navigate(`/app/search?sessionId=${s.id}`)
                  }
                >
                  <Search className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {s.province}
                      {s.district ? ` / ${s.district}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.category} · {s.total_results}{" "}
                      {t("dashboard.results")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent lists */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              {t("dashboard.recentLists")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/app/lists")}
            >
              {t("dashboard.viewAll")}
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          </div>
          {recentLists.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("dashboard.noLists")}
            </p>
          ) : (
            <ul className="space-y-1">
              {recentLists.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/app/lists/${l.id}`)}
                >
                  <List className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.lead_count} {t("dashboard.leads")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent exports */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              {t("dashboard.recentExports")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/app/exports")}
            >
              {t("dashboard.viewAll")}
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          </div>
          {recentExports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("dashboard.noExports")}
            </p>
          ) : (
            <ul className="space-y-1">
              {recentExports.map((e) => (
                <li key={e.id} className="flex items-start gap-2 p-2 rounded-lg">
                  <FileDown className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {e.listName}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">
                      {e.format} · {e.leadCount} {t("dashboard.leads")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
