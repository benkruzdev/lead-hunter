import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminExports } from "@/lib/api";
import { useTranslation } from "react-i18next";

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.exports.title')}</h1>
                <p className="text-muted-foreground">{t('admin.exports.description')}</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileDown className="w-5 h-5" />
                            {t('admin.exports.title')}
                        </CardTitle>
                        <CardDescription>Toplam {total.toLocaleString()} export kaydı</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                                            <th className="pb-2 pr-4 font-medium">Liste</th>
                                            <th className="pb-2 pr-4 font-medium">Format</th>
                                            <th className="pb-2 pr-4 font-medium">Lead Sayısı</th>
                                            <th className="pb-2 pr-4 font-medium">Not</th>
                                            <th className="pb-2 font-medium">Tarih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {exports_.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                                                    Kayıt bulunamadı
                                                </td>
                                            </tr>
                                        )}
                                        {exports_.map(exp => (
                                            <tr key={exp.id} className="hover:bg-muted/40">
                                                <td className="py-2 pr-4">
                                                    <div className="font-medium text-sm">{exp.user_name || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {exp.user_email || exp.user_id.slice(0, 8) + "…"}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-4 max-w-[160px] truncate">
                                                    {exp.list_name || "—"}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className="text-xs font-semibold uppercase bg-muted px-2 py-0.5 rounded-full">
                                                        {exp.format}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-center font-medium">
                                                    {exp.lead_count}
                                                </td>
                                                <td className="py-2 pr-4 max-w-[160px] truncate text-muted-foreground">
                                                    {exp.note || "—"}
                                                </td>
                                                <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(exp.created_at).toLocaleString("tr-TR")}
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
