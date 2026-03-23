import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminSystemLogs } from "@/lib/api";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 50;

const EVENT_TYPES = [
    { value: '', label: 'Tümü' },
    { value: 'admin_grant', label: 'Admin Kredi Yükleme' },
    { value: 'admin_deduction', label: 'Admin Kredi Düşme' },
    { value: 'order_complete', label: 'Ödeme Onayı' },
    { value: 'search_started', label: 'Arama Başlatıldı' },
    { value: 'page_view_paid', label: 'Kayıt Yükleme (Ücretli)' },
    { value: 'enrichment_success', label: 'Zenginleştirme Başarılı' },
    { value: 'enrichment_failed', label: 'Zenginleştirme Başarısız' },
    { value: 'export_created', label: 'Dışa Aktarma' },
    { value: 'lead_added_to_list', label: 'Lead Listeye Eklendi' },
    { value: 'system_settings_updated', label: 'Sistem Ayarları Güncellendi' },
];

type LogEvent = {
    id: string;
    level: 'info' | 'warn' | 'error' | 'success';
    source: string;
    event_type: string;
    actor_user_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    subject_user_id: string | null;
    subject_name: string | null;
    subject_email: string | null;
    target_type: string | null;
    target_id: string | null;
    message: string;
    credit_delta: number | null;
    metadata: Record<string, unknown>;
    created_at: string;
};

function LevelBadge({ level }: { level: LogEvent['level'] }) {
    const styles: Record<string, string> = {
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    const labels: Record<string, string> = {
        info: 'info',
        warn: 'uyarı',
        success: 'başarı',
        error: 'hata',
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[level] || styles.info}`}>
            {labels[level] || level}
        </span>
    );
}

function CreditDeltaBadge({ delta }: { delta: number | null }) {
    if (delta == null) return <span className="text-muted-foreground text-xs">—</span>;
    if (delta === 0) return <span className="text-muted-foreground text-xs">0</span>;
    const positive = delta > 0;
    return (
        <span className={`text-xs font-semibold ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {positive ? '+' : ''}{delta}
        </span>
    );
}

function UserCell({ name, email }: { name: string | null; email: string | null }) {
    if (!name && !email) return <span className="text-muted-foreground text-xs">—</span>;
    return (
        <div>
            {name && <p className="font-medium truncate">{name}</p>}
            {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
    );
}

export default function AdminSystemLogsPage() {
    const { t } = useTranslation();

    const [events, setEvents] = useState<LogEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [eventTypeFilter, setEventTypeFilter] = useState('');

    const load = useCallback(async (p: number, etf: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAdminSystemLogs({
                limit: PAGE_SIZE,
                offset: p * PAGE_SIZE,
                event_type: etf || undefined,
            });
            setEvents(res.events);
            setTotal(res.total);
        } catch (err: any) {
            setError(err.message || 'Sistem logları yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, eventTypeFilter); }, [page, eventTypeFilter, load]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEventTypeFilter(e.target.value);
        setPage(0);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t('admin.systemLogs.title')}</h1>
                    <p className="text-muted-foreground">{t('admin.systemLogs.description')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => load(page, eventTypeFilter)} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            {t('admin.systemLogs.title')}
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                                {total.toLocaleString('tr-TR')} kayıt
                            </span>
                        </CardTitle>
                        <select
                            value={eventTypeFilter}
                            onChange={handleTypeChange}
                            className="border rounded px-2 py-1 text-sm bg-background text-foreground"
                        >
                            {EVENT_TYPES.map(et => (
                                <option key={et.value} value={et.value}>{et.label}</option>
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
                                            <th className="pb-2 pr-3 font-medium">Kaynak</th>
                                            <th className="pb-2 pr-3 font-medium">Olay Tipi</th>
                                            <th className="pb-2 pr-3 font-medium">{t('admin.systemLogs.table.actor')}</th>
                                            <th className="pb-2 pr-3 font-medium">Konu (Subject)</th>
                                            <th className="pb-2 pr-3 font-medium">{t('admin.systemLogs.table.action')}</th>
                                            <th className="pb-2 pr-3 font-medium text-right">Kredi Δ</th>
                                            <th className="pb-2 font-medium">{t('admin.systemLogs.table.createdAt')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {events.map(ev => (
                                            <tr key={ev.id} className="hover:bg-muted/30">
                                                <td className="py-2 pr-3">
                                                    <LevelBadge level={ev.level} />
                                                </td>
                                                <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                                                    {ev.source}
                                                </td>
                                                <td className="py-2 pr-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                                                    {ev.event_type}
                                                </td>
                                                <td className="py-2 pr-3 max-w-[9rem]">
                                                    <UserCell name={ev.actor_name} email={ev.actor_email} />
                                                </td>
                                                <td className="py-2 pr-3 max-w-[9rem]">
                                                    <UserCell name={ev.subject_name} email={ev.subject_email} />
                                                </td>
                                                <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[16rem]">
                                                    <span className="line-clamp-2">{ev.message}</span>
                                                </td>
                                                <td className="py-2 pr-3 text-right">
                                                    <CreditDeltaBadge delta={ev.credit_delta} />
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
