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
    Search, List, FileDown, CreditCard, Clock, ArrowRight, Zap, ChevronRight, Activity, MapPin, Briefcase
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatDistanceToNow } from "date-fns";
import { tr, enUS } from "date-fns/locale";

function getCountryPrefix(countryCode?: string | null): string {
    const code = countryCode ?? 'TR';
    if (code === 'TR') return '';
    const entry = COUNTRY_BY_CODE.get(code);
    return entry ? `${entry.flag} ` : '';
}

export default function DashboardPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { profile: authProfile, credits: contextCredits } = useAuth();
    
    // Select locale for relative dates
    const dateLocale = i18n.language?.startsWith('en') ? enUS : tr;

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
            iconClass: "bg-blue-500/10 text-blue-500",
            onClick: () => navigate(`/app/search?sessionId=${s.id}`)
        })),
        ...lists.map(l => ({
            id: `l-${l.id}`,
            type: 'list' as const,
            title: l.name,
            subtitle: `${l.lead_count} ${t("dashboard.leads", "Lead")}`,
            date: new Date(l.updated_at),
            icon: List,
            iconClass: "bg-emerald-500/10 text-emerald-500",
            onClick: () => navigate(`/app/lists/${l.id}`)
        })),
        ...exports.map(e => ({
            id: `e-${e.id}`,
            type: 'export' as const,
            title: e.listName,
            subtitle: `${e.format.toUpperCase()} · ${e.leadCount} ${t("dashboard.leads", "Lead")}`,
            date: new Date(e.createdAt),
            icon: FileDown,
            iconClass: "bg-purple-500/10 text-purple-500",
            onClick: () => navigate(`/app/exports`)
        }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);

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
        { label: t("layout.searchHistory", "Arama Geçmişi"), desc: "Önceki çalışmalarınız", icon: Clock, path: "/app/history" },
        { label: t("layout.leadLists", "Lead Listeleri"), desc: "Kaydedilmiş sonuçlar", icon: List, path: "/app/lists" },
        { label: t("layout.exports", "Dışa Aktarımlar"), desc: "Excel ve CSV dosyaları", icon: FileDown, path: "/app/exports" },
    ];

    return (
        <PageContainer maxWidth="xl">
            {/* Hero */}
            <PageHeader
                title={firstName ? `${t("dashboard.welcome")}, ${firstName}` : t("dashboard.welcome")}
                description={t("dashboard.welcomeDesc", "LeadHunter kontrol panelinize hoş geldiniz.")}
                actions={
                    <Button onClick={() => navigate("/app/search")} className="shrink-0 shadow-sm" size="lg">
                        <Search className="w-4 h-4 mr-2" />
                        {t("dashboard.newSearch", "Yeni Arama")}
                    </Button>
                }
            />

            {/* Resume Last Search (Premium Focus) */}
            {lastSession && (
                <div 
                    className="group relative overflow-hidden bg-card hover:bg-muted/30 border border-primary/20 hover:border-primary/40 rounded-2xl p-6 sm:p-8 mb-8 cursor-pointer shadow-sm transition-all duration-300"
                    onClick={() => navigate(`/app/search?sessionId=${lastSession.id}`)}
                >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/80" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <span className="text-xs font-bold text-primary tracking-wide">
                                    {t("dashboard.lastSearch", "Kaldığınız Yerden Devam Edin")}
                                </span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 gap-x-6">
                                <div className="flex items-center gap-2 text-foreground font-medium">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    <span>
                                        {getCountryPrefix(lastSession.country_code)}
                                        {lastSession.province}{lastSession.district ? ` / ${lastSession.district}` : ""}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-foreground font-medium">
                                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                                    <span>{lastSession.category}</span>
                                </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                                {lastSession.total_results} {t("dashboard.results", "potansiyel müşteri bulundu")}. Listelemeye devam etmek için tıklayın.
                            </p>
                        </div>
                        <Button variant="default" className="shrink-0 shadow-sm sm:w-auto w-full group-hover:bg-primary/95 transition-colors">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Unified Recent Activity (Polished) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground tracking-wide">
                            {t("dashboard.recentActivity", "Son Hareketler")}
                        </h2>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 bg-card border rounded-2xl text-muted-foreground opacity-60">
                            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
                            Yükleniyor...
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
                            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">Henüz bir hareket bulunmuyor.</p>
                            <p className="text-xs opacity-70 mt-1">Yaptığınız arama ve listelemeler burada görünür.</p>
                        </div>
                    ) : (
                        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                            <div className="divide-y divide-border/50">
                                {timeline.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-start gap-4 p-4 hover:bg-muted/40 cursor-pointer transition-all duration-200"
                                        onClick={item.onClick}
                                    >
                                        <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${item.iconClass}`}>
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1 py-0.5">
                                            <div className="font-semibold text-sm text-foreground truncate">{item.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                                <span>{item.subtitle}</span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <span>
                                                    {formatDistanceToNow(item.date, { addSuffix: true, locale: dateLocale })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="py-2">
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground/80 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Secondary Panel / Workspace Shortcuts */}
                <div className="space-y-6">
                    {/* Quick Actions (Polished Block) */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-foreground tracking-wide">
                            {t("dashboard.quickActions", "Çalışma Alanı")}
                        </h2>
                        <div className="bg-card border rounded-2xl p-3 flex flex-col gap-1 shadow-sm">
                            {quickActions.map((action) => (
                                <button
                                    key={action.path}
                                    className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                    onClick={() => navigate(action.path)}
                                >
                                    <div className="p-2 bg-muted rounded-lg shrink-0 text-muted-foreground group-hover:text-foreground group-hover:bg-background transition-colors">
                                        <action.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                            {action.label}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {action.desc}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Billing Context */}
                    <div className="bg-card border border-primary/10 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="relative z-10 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-primary font-medium">
                                <CreditCard className="w-4 h-4" />
                                <span className="text-sm">{t("layout.billing", "Faturalandırma")}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {credits.toLocaleString()} krediniz kaldı. Büyük bir liste öncesinde kredilerinizi yönetin veya yeni bakiye yükleyin.
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full mt-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                                onClick={() => navigate("/app/billing")}
                            >
                                {t("layout.buyCredits", "Kredi Satın Al")}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
