import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, DollarSign, LineChart, Loader2, AlertCircle, RefreshCw, TrendingUp, Search, FileDown, Users } from "lucide-react";
import { getAdminCosts } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface CostData {
    api_calls: {
        total_search_sessions: number;
        search_sessions_30d: number;
        page_views_30d: number;
        total_exports: number;
        exports_30d: number;
        leads_exported_30d: number;
    };
    credits: {
        issued_30d: number;
        consumed_30d: number;
        sold_30d: number;
        pending_orders: number;
        revenue_try_30d: number;
    };
    daily_breakdown: Array<{
        date: string;
        searches: number;
        exports: number;
        leads_exported: number;
    }>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

export default function AdminCostPanelPage() {
    const { t } = useTranslation();

    const [data, setData] = useState<CostData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminCosts();
            setData(result);
        } catch (err: any) {
            setError(err.message || "Maliyet verileri yüklenemedi");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const maxSearches = data ? Math.max(...data.daily_breakdown.map(d => d.searches), 1) : 1;
    const maxExports = data ? Math.max(...data.daily_breakdown.map(d => d.exports), 1) : 1;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t('admin.costs.title')}</h1>
                    <p className="text-muted-foreground">{t('admin.costs.description')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Yenile
                </Button>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {error && (
                <div className="flex flex-col items-center py-12 gap-2 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && data && (
                <>
                    {/* API Calls */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                {t('admin.costs.apiCalls.title')}
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün / toplam)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <StatCard
                                    label="Arama Oturumu (30g)"
                                    value={data.api_calls.search_sessions_30d.toLocaleString("tr-TR")}
                                    sub={`Toplam: ${data.api_calls.total_search_sessions.toLocaleString("tr-TR")}`}
                                />
                                <StatCard
                                    label="Sayfa Görüntüleme (30g)"
                                    value={data.api_calls.page_views_30d.toLocaleString("tr-TR")}
                                    sub="Ücretli pagination sayısı"
                                />
                                <StatCard
                                    label="Export (30g)"
                                    value={data.api_calls.exports_30d.toLocaleString("tr-TR")}
                                    sub={`Toplam: ${data.api_calls.total_exports.toLocaleString("tr-TR")}`}
                                />
                                <StatCard
                                    label="Export Edilen Lead (30g)"
                                    value={data.api_calls.leads_exported_30d.toLocaleString("tr-TR")}
                                    sub="Tüm export'lardaki kayıt sayısı"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Credits & Revenue */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                {t('admin.costs.estimatedCost.title')}
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <StatCard
                                    label="Verilen Kredi (30g)"
                                    value={data.credits.issued_30d.toLocaleString("tr-TR")}
                                    sub="credit_ledger pozitif toplamı"
                                />
                                <StatCard
                                    label="Tüketilen Kredi (30g)"
                                    value={data.credits.consumed_30d.toLocaleString("tr-TR")}
                                    sub="credit_ledger negatif toplamı"
                                />
                                <StatCard
                                    label="Satılan Kredi (30g)"
                                    value={data.credits.sold_30d.toLocaleString("tr-TR")}
                                    sub="Tamamlanan siparişler"
                                />
                                <StatCard
                                    label="Gelir (30g)"
                                    value={`${data.credits.revenue_try_30d.toLocaleString("tr-TR")} ₺`}
                                    sub="Tamamlanan ödemeler"
                                />
                                <StatCard
                                    label="Bekleyen Sipariş"
                                    value={data.credits.pending_orders.toLocaleString("tr-TR")}
                                    sub="Onay bekliyor"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Daily Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LineChart className="w-5 h-5" />
                                {t('admin.costs.dailyCharts.title')}
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.daily_breakdown.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 text-sm">Veri bulunamadı</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="pb-2 pr-4 font-medium">Tarih</th>
                                                <th className="pb-2 pr-4 font-medium">
                                                    <span className="flex items-center gap-1"><Search className="w-3 h-3" /> Arama</span>
                                                </th>
                                                <th className="pb-2 pr-4 font-medium">
                                                    <span className="flex items-center gap-1"><Search className="w-3 h-3 opacity-0" /> Grafik</span>
                                                </th>
                                                <th className="pb-2 pr-4 font-medium">
                                                    <span className="flex items-center gap-1"><FileDown className="w-3 h-3" /> Export</span>
                                                </th>
                                                <th className="pb-2 font-medium">
                                                    <span className="flex items-center gap-1"><FileDown className="w-3 h-3 opacity-0" /> Grafik</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {data.daily_breakdown.map(day => (
                                                <tr key={day.date} className="hover:bg-muted/30">
                                                    <td className="py-1.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(day.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                                    </td>
                                                    <td className="py-1.5 pr-2 font-medium w-12 text-center">{day.searches}</td>
                                                    <td className="py-1.5 pr-4 w-40">
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full"
                                                                style={{ width: `${Math.round((day.searches / maxSearches) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-1.5 pr-2 font-medium w-12 text-center">{day.exports}</td>
                                                    <td className="py-1.5 w-40">
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-green-500 rounded-full"
                                                                style={{ width: `${Math.round((day.exports / maxExports) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
