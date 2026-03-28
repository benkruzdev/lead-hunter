import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRY_BY_CODE } from "@/config/countries";
import { getSearchSessions, getLeadLists, getExports, getCredits } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageContainer } from "@/components/shared/PageContainer";
import {
    Search, List, FileDown, CreditCard, Clock, ArrowRight, Zap, ChevronRight, Activity
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";

function getCountryPrefix(countryCode?: string | null): string {
    const code = countryCode ?? 'TR';
    if (code === 'TR') return '';
    const entry = COUNTRY_BY_CODE.get(code);
    return entry ? `${entry.flag} ` : '';
}

export default function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile: authProfile, credits: contextCredits } = useAuth();

    const firstName =
        authProfile?.full_name?.split(" ")[0] ||
        authProfile?.email?.split("@")[0] ||
        "";

    // Data fetching using TanStack Query
    const { data: creditsData } = useQuery({
        queryKey: QUERY_KEYS.credits,
        queryFn: getCredits,
        enabled: contextCredits === null,
    });
    const credits = contextCredits ?? creditsData?.credits ?? 0;

    const { data: sessions = [], isLoading: loadingSessions } = useQuery({
        queryKey: ['searchSessions'],
        queryFn: async () => {
            const res = await getSearchSessions();
            return res.sessions;
        }
    });

    const { data: lists = [], isLoading: loadingLists } = useQuery({
        queryKey: ['leadLists'],
        queryFn: async () => {
            const res = await getLeadLists();
            return res.lists;
        }
    });

    const { data: exports = [], isLoading: loadingExports } = useQuery({
        queryKey: ['exports'],
        queryFn: async () => {
            const res = await getExports();
            return res.exports;
        }
    });

    const isLoading = loadingSessions || loadingLists || loadingExports;

    // Derived states
    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastSession = sortedSessions[0] ?? null;

    // Unified timeline items
    const timeline = [
        ...sessions.map(s => ({
            id: `s-${s.id}`,
            type: 'search' as const,
            title: `${getCountryPrefix(s.country_code)}${s.province}${s.district ? ` / ${s.district}` : ""}`,
            subtitle: `${s.category} · ${s.total_results} ${t("dashboard.results", "Sonuç")}`,
            date: new Date(s.created_at),
            icon: Search,
            onClick: () => navigate(`/app/search?sessionId=${s.id}`)
        })),
        ...lists.map(l => ({
            id: `l-${l.id}`,
            type: 'list' as const,
            title: l.name,
            subtitle: `${l.lead_count} ${t("dashboard.leads", "Lead")}`,
            date: new Date(l.updated_at),
            icon: List,
            onClick: () => navigate(`/app/lists/${l.id}`)
        })),
        ...exports.map(e => ({
            id: `e-${e.id}`,
            type: 'export' as const,
            title: e.listName,
            subtitle: `${e.format.toUpperCase()} · ${e.leadCount} ${t("dashboard.leads", "Lead")}`,
            date: new Date(e.createdAt),
            icon: FileDown,
            onClick: () => navigate(`/app/exports`)
        }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

    const stats = [
        {
            label: t("dashboard.creditsRemaining"),
            value: credits.toLocaleString(),
            icon: Zap,
            colorScheme: "warning" as const,
        },
        {
            label: t("dashboard.totalSearches"),
            value: sessions.length,
            icon: Search,
            colorScheme: "info" as const,
        },
        {
            label: t("dashboard.totalLists"),
            value: lists.length,
            icon: List,
            colorScheme: "success" as const,
        },
        {
            label: t("dashboard.totalExports"),
            value: exports.length,
            icon: FileDown,
            colorScheme: "accent" as const,
        },
    ];

    const quickActions = [
        { label: t("layout.searchHistory"), icon: Clock, path: "/app/history" },
        { label: t("layout.leadLists"), icon: List, path: "/app/lists" },
        { label: t("layout.exports"), icon: FileDown, path: "/app/exports" },
        { label: t("layout.buyCredits"), icon: CreditCard, path: "/app/billing" },
    ];

    return (
        <PageContainer maxWidth="xl">
            {/* Hero */}
            <PageHeader
                title={firstName ? `${t("dashboard.welcome")}, ${firstName}` : t("dashboard.welcome")}
                description={t("dashboard.welcomeDesc")}
                actions={
                    <Button onClick={() => navigate("/app/search")} className="shrink-0" size="lg">
                        <Search className="w-4 h-4 mr-2" />
                        {t("dashboard.newSearch", "Yeni Arama")}
                    </Button>
                }
            />

            {/* Resume Last Search (Prominent) */}
            {lastSession && (
                <div 
                    className="group bg-card hover:bg-muted/50 border rounded-xl p-5 sm:p-6 mb-6 cursor-pointer transition-colors shadow-sm"
                    onClick={() => navigate(`/app/search?sessionId=${lastSession.id}`)}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                                    {t("dashboard.lastSearch", "Kaldığınız Yerden Devam Edin")}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">
                                {getCountryPrefix(lastSession.country_code)}{lastSession.province}
                                {lastSession.district ? ` / ${lastSession.district}` : ""} — {lastSession.category}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {lastSession.total_results} {t("dashboard.results", "sonuç")} bulundu. Sonuçları incelemeye devam edin.
                            </p>
                        </div>
                        <Button variant="default" className="shrink-0 shadow-sm sm:w-auto w-full group-hover:bg-primary/90">
                            {t("dashboard.continueSearch", "Aramayı Gör")}
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => (
                    <MetricCard
                        key={stat.label}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        colorScheme={stat.colorScheme}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Unified Recent Activity */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            {t("dashboard.recentActivity", "Son Hareketler")}
                        </h2>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8 bg-card border rounded-xl text-muted-foreground">
                            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                            Yükleniyor...
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Henüz bir hareket bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="bg-card border rounded-xl divide-y">
                            {timeline.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={item.onClick}
                                >
                                    <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5">
                                        <item.icon className="w-4 h-4 text-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">{item.title}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</div>
                                    </div>
                                    <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                        {item.date.toLocaleDateString("tr-TR")}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-2" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions (De-emphasized) */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-foreground">
                        {t("dashboard.quickActions")}
                    </h2>
                    <div className="bg-card border rounded-xl p-2 flex flex-col gap-1">
                        {quickActions.map((action) => (
                            <Button
                                key={action.path}
                                variant="ghost"
                                className="w-full justify-start font-normal text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(action.path)}
                            >
                                <action.icon className="w-4 h-4 mr-3 opacity-70" />
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
