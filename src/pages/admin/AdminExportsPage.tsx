import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminExports } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

const PAGE_SIZE = 50;

interface ExportRecord {
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    list_name: string | null;
    format: string;
    file_name: string;
    lead_count: number;
    note: string | null;
    created_at: string;
}

export default function AdminExportsPage() {
    const { t } = useTranslation();

    const [exports_, setExports] = useState<ExportRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeQuery, setActiveQuery] = useState("");

    const loadExports = useCallback(async (pg: number, query: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminExports({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE, query: query || undefined });
            setExports(result.exports);
            setTotal(result.total);
        } catch (err: any) {
            setError(err.message || "Export kayıtları yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadExports(page, activeQuery); }, [page, activeQuery, loadExports]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setActiveQuery(searchInput);
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const columns: ColumnDef<ExportRecord>[] = [
        {
            key: "user",
            header: "Kullanıcı",
            render: (exp) => (
                <div>
                    <div className="font-medium text-sm">{exp.user_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                        {exp.user_email || exp.user_id.slice(0, 8) + "…"}
                    </div>
                </div>
            ),
        },
        {
            key: "list_name",
            header: "Liste",
            className: "max-w-[160px] truncate",
            render: (exp) => exp.list_name || "—",
        },
        {
            key: "format",
            header: "Format",
            render: (exp) => (
                <span className="text-xs font-semibold uppercase bg-muted px-2 py-0.5 rounded-full">
                    {exp.format}
                </span>
            ),
        },
        {
            key: "lead_count",
            header: "Lead Sayısı",
            className: "text-center font-medium tabular-nums",
            render: (exp) => exp.lead_count,
        },
        {
            key: "note",
            header: "Not",
            className: "max-w-[160px] truncate text-muted-foreground",
            render: (exp) => exp.note || "—",
        },
        {
            key: "created_at",
            header: "Tarih",
            className: "text-xs text-muted-foreground whitespace-nowrap",
            render: (exp) => new Date(exp.created_at).toLocaleString("tr-TR"),
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
                title={t("admin.exports.title")}
                description={t("admin.exports.description")}
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="Kullanıcı veya format…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-48"
                            />
                            <Button type="submit" variant="outline" size="sm">Ara</Button>
                        </form>
                        <Button variant="outline" size="sm" onClick={() => loadExports(page, activeQuery)} disabled={loading}>
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
                <DataTable<ExportRecord>
                    columns={columns}
                    data={exports_}
                    getRowKey={(exp) => exp.id}
                    isLoading={loading}
                    emptyState={
                        <div className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                            <FileDown className="w-8 h-8 opacity-40" />
                            <p className="text-sm">Kayıt bulunamadı</p>
                        </div>
                    }
                    footer={paginationFooter}
                />
            )}
        </div>
    );
}
