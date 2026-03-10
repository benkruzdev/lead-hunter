import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminSystemLogs } from "@/lib/api";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 50;

// Only types actually written to credit_ledger by Node.js routes:
//   order_complete  → admin.js: POST /payments/:orderId/complete
//   admin_grant     → admin.js: POST /credits/adjust (amount > 0)
//   admin_deduction → admin.js: POST /credits/adjust (amount < 0)
//
// NOT logged anywhere (no credit_ledger INSERT in their code paths):
//   page_view   — search pagination uses decrement_credits RPC (no ledger write in JS)
//   enrichment  — lists.js uses decrement_credits RPC (no ledger write in JS)
//   new_user    — signup does not write to credit_ledger at all
//   lead_add    — add_leads_to_list_atomic RPC updates profiles.credits directly, no ledger
const KNOWN_TYPES = [
    { value: '', label: 'Tümü' },
    { value: 'order_complete', label: 'Ödeme Onayı' },
    { value: 'admin_grant', label: 'Admin Kredi Yükleme' },
    { value: 'admin_deduction', label: 'Admin Kredi Düşme' },
];


type LogEvent = {
    id: string;
    type: string;
    description: string | null;
    amount: number;
    actor_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    level: 'info' | 'warn' | 'success';
    created_at: string;
};

function LevelBadge({ level }: { level: LogEvent['level'] }) {
    const styles: Record<string, string> = {
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    const labels: Record<string, string> = {
        info: 'info',
        warn: 'uyarı',
        success: 'başarı',
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[level] || styles.info}`}>
            {labels[level] || level}
        </span>
    );
}

function AmountBadge({ amount }: { amount: number }) {
    if (amount === 0) return <span className="text-muted-foreground text-xs">—</span>;
    const positive = amount > 0;
    return (
        <span className={`text-xs font-semibold ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {positive ? '+' : ''}{amount}
        </span>
    );
}

export default function AdminSystemLogsPage() {
    const { t } = useTranslation();

    const [events, setEvents] = useState<LogEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [typeFilter, setTypeFilter] = useState('');

    const load = useCallback(async (p: number, tf: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAdminSystemLogs({
                limit: PAGE_SIZE,
                offset: p * PAGE_SIZE,
                type: tf || undefined,
            });
            setEvents(res.events);
            setTotal(res.total);
        } catch (err: any) {
            setError(err.message || 'Sistem logları yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, typeFilter); }, [page, typeFilter, load]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setTypeFilter(e.target.value);
        setPage(0);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t('admin.systemLogs.title')}</h1>
                    <p className="text-muted-foreground">{t('admin.systemLogs.description')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => load(page, typeFilter)} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            {/* Info banner — honest about data source */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                    Sistem logları <strong>credit_ledger</strong> tablosundan türetilmektedir — dedicated audit tablosu mevcut değil.{' '}
                    <strong>Loglanan olaylar:</strong> Ödeme onayı, admin kredi yükleme/düşme.{' '}
                    <strong>Loglanmayanlar:</strong> Sayfa görüntüleme / sayfalama (RPC doğrudan profiles günceller), zenginleştirme (decrement_credits RPC), lead ekleme (add_leads_to_list_atomic RPC), yeni kayıt.
                </span>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            {t('admin.systemLogs.title')}
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                                {total.toLocaleString('tr-TR')} kayıt
                            </span>
                        </CardTitle>
                        <select
                            value={typeFilter}
                            onChange={handleTypeChange}
                            className="border rounded px-2 py-1 text-sm bg-background text-foreground"
                        >
                            {KNOWN_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex flex-col items-center py-12 gap-2 text-destructive">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {!loading && !error && events.length === 0 && (
                        <p className="text-center text-muted-foreground py-12 text-sm">
                            Kayıt bulunamadı
                        </p>
                    )}

                    {!loading && !error && events.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="pb-2 pr-3 font-medium">Seviye</th>
                                            <th className="pb-2 pr-3 font-medium">Tip</th>
                                            <th className="pb-2 pr-3 font-medium">
                                                {t('admin.systemLogs.table.actor')}
                                            </th>
                                            <th className="pb-2 pr-3 font-medium">
                                                {t('admin.systemLogs.table.action')}
                                            </th>
                                            <th className="pb-2 pr-3 font-medium text-right">Kredi</th>
                                            <th className="pb-2 font-medium">
                                                {t('admin.systemLogs.table.createdAt')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {events.map(ev => (
                                            <tr key={ev.id} className="hover:bg-muted/30">
                                                <td className="py-2 pr-3">
                                                    <LevelBadge level={ev.level} />
                                                </td>
                                                <td className="py-2 pr-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                                                    {ev.type}
                                                </td>
                                                <td className="py-2 pr-3 max-w-[10rem]">
                                                    {ev.actor_name || ev.actor_email ? (
                                                        <div>
                                                            {ev.actor_name && (
                                                                <p className="font-medium truncate">{ev.actor_name}</p>
                                                            )}
                                                            {ev.actor_email && (
                                                                <p className="text-xs text-muted-foreground truncate">{ev.actor_email}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[16rem]">
                                                    <span className="line-clamp-2">{ev.description || '—'}</span>
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    <AmountBadge amount={ev.amount} />
                                                </td>
                                                <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(ev.created_at).toLocaleString('tr-TR', {
                                                        day: '2-digit', month: 'short',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Sayfa {page + 1} / {totalPages} · Toplam {total.toLocaleString('tr-TR')} kayıt
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                        >
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
