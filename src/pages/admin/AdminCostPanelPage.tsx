import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, DollarSign, LineChart, Loader2, AlertCircle, RefreshCw, Search, FileDown, TrendingUp, Info } from "lucide-react";
import { getAdminCosts } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface CostData {
    usage: {
        sessions_30d: number;
        total_sessions: number;
        total_page_views_30d: number;
        paid_page_views_30d: number;
        sessions_with_min_reviews_30d: number;
        exports_30d: number;
        total_exports: number;
        leads_exported_30d: number;
    };
    places_estimates: {
        text_search_calls_30d: number;
        place_details_calls_30d: number;
        details_from_first_pages: number;
        details_from_paid_pages: number;
        details_from_min_reviews_filter: number;
        cost_text_search_usd: number;
        cost_details_usd: number;
        cost_total_usd: number;
        cost_free_surface_usd: number;
        cost_paid_surface_usd: number;
        price_text_search_usd: number;
        price_details_usd: number;
    };
    credits: {
        per_page: number;
        per_enrichment: number;
        issued_30d: number;
        consumed_30d: number;
        sold_30d: number;
        revenue_try_30d: number;
        pending_orders: number;
    };
    daily_breakdown: Array<{
        date: string;
        searches: number;
        exports: number;
        leads_exported: number;
        est_text_search_calls: number;
        est_details_calls: number;
        est_cost_usd: number;
    }>;
}

function StatCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
    return (
        <div className={`rounded-lg border p-4 ${warn ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "bg-card"}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${warn ? "text-orange-600 dark:text-orange-400" : ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

function EstimateBadge() {
    return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full ml-2">
            <Info className="w-3 h-3" /> Tahmini
        </span>
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
            setData(await getAdminCosts());
        } catch (err: any) {
            setError(err.message || "Maliyet verileri yüklenemedi");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const maxCost = data ? Math.max(...data.daily_breakdown.map(d => d.est_cost_usd), 0.001) : 0.001;
    const maxSearches = data ? Math.max(...data.daily_breakdown.map(d => d.searches), 1) : 1;

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
                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                            Places API maliyetleri <strong>kod akışından türetilmiş üst sınır tahmindir</strong> — canlı telemetri değil.
                            Text Search: <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">${data.places_estimates.price_text_search_usd}/çağrı</code>,
                            Place Details: <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">${data.places_estimates.price_details_usd}/çağrı</code>
                        </span>
                    </div>

                    {/* Places API Cost Estimate */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                {t('admin.costs.estimatedCost.title')}
                                <EstimateBadge />
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCard
                                    label="Tahmini Toplam Gider"
                                    value={`$${data.places_estimates.cost_total_usd.toFixed(4)}`}
                                    sub="Text Search + Place Details"
                                    warn={data.places_estimates.cost_total_usd > 1}
                                />
                                <StatCard
                                    label="Ücretsiz Yüzey Gideri"
                                    value={`$${data.places_estimates.cost_free_surface_usd.toFixed(4)}`}
                                    sub="Kullanıcının kredi ödemediği akışlar"
                                    warn={data.places_estimates.cost_free_surface_usd > 0.5}
                                />
                                <StatCard
                                    label="Ücretli Yüzey Gideri"
                                    value={`$${data.places_estimates.cost_paid_surface_usd.toFixed(4)}`}
                                    sub="Kredi ile karşılanan akışlar"
                                />
                                <StatCard
                                    label="Gelir (30g)"
                                    value={`${data.credits.revenue_try_30d.toLocaleString("tr-TR")} ₺`}
                                    sub="Tamamlanan ödemeler"
                                />
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="text-left text-muted-foreground">
                                            <th className="px-3 py-2 font-medium">Kalem</th>
                                            <th className="px-3 py-2 font-medium text-right">Çağrı (tahmini)</th>
                                            <th className="px-3 py-2 font-medium text-right">Birim</th>
                                            <th className="px-3 py-2 font-medium text-right">Maliyet (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-3 py-2">Text Search (New)</td>
                                            <td className="px-3 py-2 text-right font-medium">{data.places_estimates.text_search_calls_30d}</td>
                                            <td className="px-3 py-2 text-right text-muted-foreground">${data.places_estimates.price_text_search_usd}</td>
                                            <td className="px-3 py-2 text-right font-medium">${data.places_estimates.cost_text_search_usd.toFixed(4)}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2">
                                                <div>Place Details (New)</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    İlk sayfa: {data.places_estimates.details_from_first_pages} &nbsp;·&nbsp;
                                                    Ücretli sayfa: {data.places_estimates.details_from_paid_pages} &nbsp;·&nbsp;
                                                    minReviews filtresi: {data.places_estimates.details_from_min_reviews_filter}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">{data.places_estimates.place_details_calls_30d}</td>
                                            <td className="px-3 py-2 text-right text-muted-foreground">${data.places_estimates.price_details_usd}</td>
                                            <td className="px-3 py-2 text-right font-medium">${data.places_estimates.cost_details_usd.toFixed(4)}</td>
                                        </tr>
                                        <tr className="bg-muted/30 font-semibold">
                                            <td className="px-3 py-2">Toplam</td>
                                            <td className="px-3 py-2 text-right">{data.places_estimates.text_search_calls_30d + data.places_estimates.place_details_calls_30d}</td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2 text-right">${data.places_estimates.cost_total_usd.toFixed(4)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* API Calls / Usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                {t('admin.costs.apiCalls.title')}
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün / toplam)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCard
                                    label="Arama Oturumu (30g)"
                                    value={data.usage.sessions_30d.toLocaleString("tr-TR")}
                                    sub={`Toplam: ${data.usage.total_sessions.toLocaleString("tr-TR")}`}
                                />
                                <StatCard
                                    label="Toplam Sayfa Görüntüleme"
                                    value={data.usage.total_page_views_30d.toLocaleString("tr-TR")}
                                    sub={`Ücretli: ${data.usage.paid_page_views_30d.toLocaleString("tr-TR")}`}
                                />
                                <StatCard
                                    label="minReviews Filtreli Oturum"
                                    value={data.usage.sessions_with_min_reviews_30d.toLocaleString("tr-TR")}
                                    sub="Ekstra details çağrısı tetikler"
                                    warn={data.usage.sessions_with_min_reviews_30d > 0}
                                />
                                <StatCard
                                    label="Export (30g)"
                                    value={data.usage.exports_30d.toLocaleString("tr-TR")}
                                    sub={`Lead: ${data.usage.leads_exported_30d.toLocaleString("tr-TR")}`}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Credits comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Kredi Modeli Karşılaştırması
                                <span className="text-xs font-normal text-muted-foreground ml-1">(son 30 gün)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <StatCard
                                    label="Kredi / Sayfa"
                                    value={data.credits.per_page}
                                    sub="system_settings'ten"
                                />
                                <StatCard
                                    label="Satılan Kredi (30g)"
                                    value={data.credits.sold_30d.toLocaleString("tr-TR")}
                                    sub={`Gelir: ${data.credits.revenue_try_30d.toLocaleString("tr-TR")} ₺`}
                                />
                                <StatCard
                                    label="Verilen Kredi (30g)"
                                    value={data.credits.issued_30d.toLocaleString("tr-TR")}
                                    sub={`Tüketilen: ${data.credits.consumed_30d.toLocaleString("tr-TR")}`}
                                />
                                <StatCard
                                    label="Bekleyen Sipariş"
                                    value={data.credits.pending_orders.toLocaleString("tr-TR")}
                                    sub="Onay bekliyor"
                                    warn={data.credits.pending_orders > 0}
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
                                <EstimateBadge />
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
                                                <th className="pb-2 pr-3 font-medium">Tarih</th>
                                                <th className="pb-2 pr-3 font-medium text-center">
                                                    <span className="flex items-center gap-1 justify-center"><Search className="w-3 h-3" />Arama</span>
                                                </th>
                                                <th className="pb-2 pr-3 font-medium text-right">TextSearch</th>
                                                <th className="pb-2 pr-3 font-medium text-right">Details</th>
                                                <th className="pb-2 pr-3 font-medium text-right">Gider (est.)</th>
                                                <th className="pb-2 font-medium">Grafik</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {data.daily_breakdown.map(day => (
                                                <tr key={day.date} className="hover:bg-muted/30">
                                                    <td className="py-1.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(day.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center font-medium">{day.searches}</td>
                                                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{day.est_text_search_calls}</td>
                                                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{day.est_details_calls}</td>
                                                    <td className="py-1.5 pr-3 text-right font-medium text-sm">
                                                        ${day.est_cost_usd.toFixed(4)}
                                                    </td>
                                                    <td className="py-1.5 w-32">
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-amber-500 rounded-full"
                                                                style={{ width: `${Math.round((day.est_cost_usd / maxCost) * 100)}%` }}
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
