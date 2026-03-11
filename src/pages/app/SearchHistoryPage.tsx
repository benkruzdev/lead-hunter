import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSearchSessions, SearchSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Clock,
    MapPin,
    Tag,
    ArrowUpDown,
    Search,
    Star,
    BookOpen,
    AlertCircle,
    Info,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useTranslation } from "react-i18next";

// ─── Location formatter (global-ready) ────────────────────────────────────────
// subregion = district/ilçe, region = city/province
// "Akyurt, Ankara" | "Ankara" | "—"
function formatSessionLocation(
    region: string | null | undefined,
    subregion: string | null | undefined
): string {
    const r = region?.trim();
    const s = subregion?.trim();
    if (s && r) return `${s}, ${r}`;
    if (r) return r;
    if (s) return s;
    return "—";
}

// ─── Two-axis scoring model ────────────────────────────────────────────────────
//
// Two independent axes derived solely from observable session data:
//   scopeScore  (0–10) — how wide the search was     → based on total_results
//   depthScore  (0–10) — how deeply it was explored  → based on viewed_pages.length
//
// Both are step functions: deliberately coarse so minor noise does not flip the badge.
// Badge is determined by the dominant axis first; if both are elevated, a combined
// variant is awarded. All 6 outcomes are fully deterministic.
//
// Badge keys:
//   deepExploration    — high depth, any scope        (depth-dominant)
//   wideAndDeep        — high scope + high depth      (both elevated)
//   broadSearch        — high scope, low-mid depth
//   broadAndExplored    — high scope + mid depth       (wide + 2 pages)
//   narrowTarget       — very low scope (niche / tight search)
//   quickScan          — baseline (mid scope, single-page view)

type SignalKey =
    | "deepExploration"
    | "wideAndDeep"
    | "broadSearch"
    | "broadAndExplored"
    | "narrowTarget"
    | "quickScan";

interface UsageSignal {
    key: SignalKey;
    className: string;
    scopeScore: number;
    depthScore: number;
}

/** Scope score: 0–10 step function based on total_results. */
function computeScopeScore(total: number): number {
    if (total > 100) return 10;
    if (total > 40)  return 7;
    if (total > 15)  return 5;
    if (total > 5)   return 3;
    return 1;
}

/** Depth score: 0–10 step function based on pages viewed. */
function computeDepthScore(pages: number): number {
    if (pages >= 4)  return 10;
    if (pages === 3) return 8;
    if (pages === 2) return 5;
    return 2; // 1 page (minimum — always at least the initial search page)
}

function getUsageSignal(session: SearchSession): UsageSignal {
    const scopeScore = computeScopeScore(session.total_results);
    const depthScore = computeDepthScore(session.viewed_pages.length);

    if (depthScore >= 8 && scopeScore >= 7) {
        return { key: "wideAndDeep",         scopeScore, depthScore, className: "bg-violet-50 text-violet-700 border-violet-200" };
    }
    if (depthScore >= 8) {
        return { key: "deepExploration",     scopeScore, depthScore, className: "bg-violet-50 text-violet-700 border-violet-200" };
    }
    if (scopeScore >= 7 && depthScore >= 5) {
        return { key: "broadAndExplored",  scopeScore, depthScore, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (scopeScore >= 7) {
        return { key: "broadSearch",         scopeScore, depthScore, className: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (scopeScore <= 1) {
        return { key: "narrowTarget",        scopeScore, depthScore, className: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return         { key: "quickScan",       scopeScore, depthScore, className: "bg-gray-100 text-gray-500 border-gray-200" };
}


// ─── Sort types ───────────────────────────────────────────────────────────────
type SortKey = "newest" | "mostExplored";

function sortSessions(sessions: SearchSession[], key: SortKey): SearchSession[] {
    return [...sessions].sort((a, b) => {
        if (key === "mostExplored") {
            const pageDiff = b.viewed_pages.length - a.viewed_pages.length;
            if (pageDiff !== 0) return pageDiff;
            // Tie-break: newer first
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        // newest (default)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SearchHistoryPage() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [sessions, setSessions] = useState<SearchSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("newest");

    const locale = i18n.language?.startsWith("tr") ? tr : undefined;

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setIsLoading(true);
            setLoadError(false);
            const { sessions: data } = await getSearchSessions();
            setSessions(data);
        } catch (error) {
            console.error("[SearchHistory] Load error:", error);
            setLoadError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = (sessionId: string) => {
        navigate(`/app/search?sessionId=${sessionId}`);
    };

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // ── Error state ──
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                    {t("searchHistory.loadError")}
                </p>
                <Button variant="outline" size="sm" onClick={loadSessions}>
                    {t("common.retry")}
                </Button>
            </div>
        );
    }

    // ── Empty state ──
    if (sessions.length === 0) {
        return (
            <div className="text-center py-16 space-y-4">
                <Search className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <div>
                    <h3 className="text-lg font-semibold">{t("searchHistory.noHistory")}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t("searchHistory.noHistoryDesc")}
                    </p>
                </div>
                <Button onClick={() => navigate("/app/search")}>
                    {t("searchHistory.newSearch")}
                </Button>
            </div>
        );
    }

    const sorted = sortSessions(sessions, sortKey);

    return (
        <div className="space-y-5">
            {/* ── Header + sort control ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">{t("searchHistory.title")}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t("searchHistory.description")}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    <Select
                        value={sortKey}
                        onValueChange={(v) => setSortKey(v as SortKey)}
                    >
                        <SelectTrigger className="h-8 w-[160px] text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">
                                {t("searchHistory.sortNewest")}
                            </SelectItem>
                            <SelectItem value="mostExplored">
                                {t("searchHistory.sortMostExplored")}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── Card list ── */}
            <div className="grid gap-3">
                {sorted.map((session) => {
                    const signal = getUsageSignal(session);
                    const location = formatSessionLocation(
                        session.province,
                        session.district
                    );
                    const pagesViewed = session.viewed_pages.length;

                    return (
                        <div
                            key={session.id}
                            className="bg-card rounded-xl border px-5 py-4 hover:shadow-sm transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* ── Left: info hierarchy ── */}
                                <div className="flex-1 min-w-0 space-y-2.5">
                                    {/* Primary: location + category */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <div className="flex items-center gap-1.5 font-semibold text-base leading-snug">
                                            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="truncate">{location}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                            <Tag className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{session.category}</span>
                                        </div>
                                        {/* Usage signal badge with tooltip */}
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none cursor-default ${signal.className}`}
                                                >
                                                    {t(`searchHistory.signal.${signal.key}`)}
                                                    <Info className="w-3 h-3 opacity-50" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[240px] text-xs space-y-1.5">
                                                <p className="font-semibold">
                                                    {t(`searchHistory.signal.${signal.key}`)}
                                                </p>
                                                <p className="text-muted-foreground leading-snug">
                                                    {t(`searchHistory.signalTooltip.${signal.key}`, {
                                                        scope: signal.scopeScore,
                                                        depth: signal.depthScore,
                                                        results: session.total_results.toLocaleString(),
                                                        pages: session.viewed_pages.length,
                                                    })}
                                                </p>
                                                <p className="text-muted-foreground/70 text-[10px] leading-snug border-t pt-1">
                                                    {t("searchHistory.signalScoreLabel", {
                                                        scope: signal.scopeScore,
                                                        depth: signal.depthScore,
                                                    })}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>

                                    {/* Secondary: keyword (if present) */}
                                    {session.keyword && (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Star className="w-3.5 h-3.5 shrink-0" />
                                            <span>
                                                {t("searchHistory.keyword")}:{" "}
                                                <span className="font-medium text-foreground">
                                                    {session.keyword}
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    {/* Tertiary: stats + time */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>
                                            <span className="font-medium text-foreground">
                                                {session.total_results.toLocaleString()}
                                            </span>{" "}
                                            {t("searchHistory.resultsFound")}
                                        </span>
                                        <span className="text-border">·</span>
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="w-3 h-3" />
                                            <span>
                                                <span className="font-medium text-foreground">
                                                    {pagesViewed}
                                                </span>{" "}
                                                {t("searchHistory.pagesViewed")}
                                            </span>
                                        </span>
                                        <span className="text-border">·</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDistanceToNow(new Date(session.created_at), {
                                                addSuffix: true,
                                                locale,
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Right: CTA ── */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 self-center"
                                    onClick={() => handleContinue(session.id)}
                                >
                                    {t("searchHistory.returnToResults")}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
