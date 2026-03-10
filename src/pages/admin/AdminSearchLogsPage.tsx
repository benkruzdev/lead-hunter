import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminSearchLogs } from "@/lib/api";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 50;

interface SearchLog {
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    province: string | null;
    district: string | null;
    category: string | null;
    keyword: string | null;
    min_rating: number | null;
    min_reviews: number | null;
    total_results: number;
    pages_viewed: number;
    created_at: string;
}

export default function AdminSearchLogsPage() {
    const { t } = useTranslation();

    const [logs, setLogs] = useState<SearchLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeQuery, setActiveQuery] = useState("");

    const loadLogs = useCallback(async (pg: number, query: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminSearchLogs({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE, query: query || undefined });
            setLogs(result.logs);
            setTotal(result.total);
        } catch (err: any) {
            setError(err.message || "Arama logları yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadLogs(page, activeQuery); }, [page, activeQuery, loadLogs]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setActiveQuery(searchInput);
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const displayLabel = (log: SearchLog) =>
        log.user_name || log.user_email || log.user_id.slice(0, 8) + "…";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.searchLogs.title')}</h1>
                <p className="text-muted-foreground">{t('admin.searchLogs.description')}</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            {t('admin.searchLogs.title')}
                        </CardTitle>
                        <CardDescription>Toplam {total.toLocaleString()} arama oturumu</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="Kullanıcı, il, kategori…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-52"
                            />
                            <Button type="submit" variant="outline" size="sm">Ara</Button>
                        </form>
                        <Button variant="outline" size="sm" onClick={() => loadLogs(page, activeQuery)} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {error && (
                        <div className="flex flex-col items-center py-10 gap-2 text-destructive">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {!loading && !error && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="pb-2 pr-4 font-medium">Kullanıcı</th>
                                            <th className="pb-2 pr-4 font-medium">İl / İlçe</th>
                                            <th className="pb-2 pr-4 font-medium">Kategori</th>
                                            <th className="pb-2 pr-4 font-medium">Anahtar Sözcük</th>
                                            <th className="pb-2 pr-4 font-medium">Sonuç</th>
                                            <th className="pb-2 pr-4 font-medium">Sayfa</th>
                                            <th className="pb-2 font-medium">Tarih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {logs.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                                                    Kayıt bulunamadı
                                                </td>
                                            </tr>
                                        )}
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-muted/40">
                                                <td className="py-2 pr-4">
                                                    <div className="font-medium text-sm">{log.user_name || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {log.user_email || log.user_id.slice(0, 8) + "…"}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span>{log.province || "—"}</span>
                                                    {log.district && <span className="text-muted-foreground"> / {log.district}</span>}
                                                </td>
                                                <td className="py-2 pr-4 max-w-[140px] truncate">
                                                    {log.category || "—"}
                                                </td>
                                                <td className="py-2 pr-4 max-w-[120px] truncate text-muted-foreground">
                                                    {log.keyword || "—"}
                                                </td>
                                                <td className="py-2 pr-4 text-center font-medium">
                                                    {log.total_results}
                                                </td>
                                                <td className="py-2 pr-4 text-center text-muted-foreground">
                                                    {log.pages_viewed}
                                                </td>
                                                <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString("tr-TR")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        Sayfa {page + 1} / {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={page === 0}
                                            onClick={() => setPage(p => p - 1)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1}
                                            onClick={() => setPage(p => p + 1)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
