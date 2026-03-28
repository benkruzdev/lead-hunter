import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminSearchLogs } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

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

    const columns: ColumnDef<SearchLog>[] = [
        {
            key: "user",
            header: "Kullanıcı",
            render: (log) => (
                <div>
                    <div className="font-medium text-sm">{log.user_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                        {log.user_email || log.user_id.slice(0, 8) + "…"}
                    </div>
                </div>
            ),
        },
        {
            key: "location",
            header: "İl / İlçe",
            render: (log) => (
                <span>
                    {log.province || "—"}
                    {log.district && <span className="text-muted-foreground"> / {log.district}</span>}
                </span>
            ),
        },
        {
            key: "category",
            header: "Kategori",
            className: "max-w-[140px] truncate",
            render: (log) => log.category || "—",
        },
        {
            key: "keyword",
            header: "Anahtar Sözcük",
            className: "max-w-[120px] truncate text-muted-foreground",
            render: (log) => log.keyword || "—",
        },
        {
            key: "total_results",
            header: "Sonuç",
            className: "text-center font-medium tabular-nums",
            render: (log) => log.total_results,
        },
        {
            key: "pages_viewed",
            header: "Sayfa",
            className: "text-center text-muted-foreground tabular-nums",
            render: (log) => log.pages_viewed,
        },
        {
            key: "created_at",
            header: "Tarih",
            className: "text-xs text-muted-foreground whitespace-nowrap",
            render: (log) => new Date(log.created_at).toLocaleString("tr-TR"),
        },
    ];

    const paginationFooter = totalPages > 1 ? (
        <div className="flex items-center justify-between px-1 py-2">
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
    ) : undefined;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("admin.searchLogs.title")}
                description={t("admin.searchLogs.description")}
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
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
                }
            />

            {error && (
                <div className="flex flex-col items-center py-10 gap-2 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {!error && (
                <DataTable<SearchLog>
                    columns={columns}
                    data={logs}
                    getRowKey={(log) => log.id}
                    isLoading={loading}
                    emptyState={
                        <div className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                            <Search className="w-8 h-8 opacity-40" />
                            <p className="text-sm">Kayıt bulunamadı</p>
                        </div>
                    }
                    footer={paginationFooter}
                />
            )}
        </div>
    );
}
