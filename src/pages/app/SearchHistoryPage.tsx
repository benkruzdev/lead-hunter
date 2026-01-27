import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSearchSessions, SearchSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Tag, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useTranslation } from "react-i18next";

export default function SearchHistoryPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<SearchSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setIsLoading(true);
            const { sessions: data } = await getSearchSessions();
            setSessions(data);
        } catch (error) {
            console.error("[SearchHistory] Load error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = (sessionId: string) => {
        navigate(`/app/search?sessionId=${sessionId}`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("searchHistory.noHistory")}</h3>
                <p className="text-muted-foreground mb-6">
                    {t("searchHistory.noHistoryDesc")}
                </p>
                <Button onClick={() => navigate("/app/search")}>
                    {t("searchHistory.newSearch")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{t("searchHistory.title")}</h1>
                <p className="text-muted-foreground">
                    {t("searchHistory.description")}
                </p>
            </div>

            <div className="grid gap-4">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className="bg-card rounded-xl border p-6 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                        {formatDistanceToNow(new Date(session.created_at), {
                                            addSuffix: true,
                                            locale: tr,
                                        })}
                                    </span>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm">
                                            {session.province}
                                            {session.district && ` / ${session.district}`}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm">{session.category}</span>
                                    </div>
                                </div>

                                {session.keyword && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{t("searchHistory.keyword")}:</span>
                                        <span className="font-medium">{session.keyword}</span>
                                    </div>
                                )}

                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium">{session.total_results}</span>{" "}
                                    {t("searchHistory.resultsFound")} •{" "}
                                    <span className="font-medium">
                                        {session.viewed_pages.length}
                                    </span>{" "}
                                    {t("searchHistory.pagesViewed")}
                                </div>
                            </div>

                            <Button onClick={() => handleContinue(session.id)}>
                                {t("searchHistory.continueSearch")}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
