import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { getAdminPayments, completeAdminOrder } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending:   { label: "Bekliyor",    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    completed: { label: "Tamamlandı", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    failed:    { label: "Başarısız",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { label: "İptal",      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

interface Order {
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    package_name: string | null;
    payment_method: string;
    amount: number;
    currency: string;
    credits: number;
    status: string;
    created_at: string;
}

export default function AdminPaymentsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();

    const [orders, setOrders] = useState<Order[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [completing, setCompleting] = useState<string | null>(null);

    const loadOrders = useCallback(async (pg: number, query: string, status: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminPayments({
                limit: PAGE_SIZE,
                offset: pg * PAGE_SIZE,
                query: query || undefined,
                status: status || undefined,
            });
            setOrders(result.orders);
            setTotal(result.total);
        } catch (err: any) {
            setError(err.message || "Siparişler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadOrders(page, activeQuery, statusFilter); }, [page, activeQuery, statusFilter, loadOrders]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setActiveQuery(searchInput);
    };

    const handleComplete = async (orderId: string) => {
        setCompleting(orderId);
        try {
            const result = await completeAdminOrder(orderId);
            toast({ title: `Sipariş tamamlandı — ${result.credits_added} kredi eklendi` });
            loadOrders(page, activeQuery, statusFilter);
        } catch (err: any) {
            toast({ title: err.message || "İşlem başarısız", variant: "destructive" });
        } finally {
            setCompleting(null);
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.payments.title')}</h1>
                <p className="text-muted-foreground">{t('admin.payments.description')}</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            {t('admin.payments.title')}
                        </CardTitle>
                        <CardDescription>Toplam {total.toLocaleString()} sipariş</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="Kullanıcı ara…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-40"
                            />
                            <Button type="submit" variant="outline" size="sm">Ara</Button>
                        </form>
                        <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                        >
                            <option value="">Tüm durumlar</option>
                            <option value="pending">Bekliyor</option>
                            <option value="completed">Tamamlandı</option>
                            <option value="failed">Başarısız</option>
                            <option value="cancelled">İptal</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={() => loadOrders(page, activeQuery, statusFilter)} disabled={loading}>
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
                                            <th className="pb-2 pr-4 font-medium">Paket</th>
                                            <th className="pb-2 pr-4 font-medium">Tutar</th>
                                            <th className="pb-2 pr-4 font-medium">Kredi</th>
                                            <th className="pb-2 pr-4 font-medium">Yöntem</th>
                                            <th className="pb-2 pr-4 font-medium">Durum</th>
                                            <th className="pb-2 pr-4 font-medium">Tarih</th>
                                            <th className="pb-2 font-medium">Aksiyon</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {orders.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="py-10 text-center text-muted-foreground">
                                                    Kayıt bulunamadı
                                                </td>
                                            </tr>
                                        )}
                                        {orders.map(order => {
                                            const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, className: "bg-muted text-muted-foreground" };
                                            return (
                                                <tr key={order.id} className="hover:bg-muted/40">
                                                    <td className="py-2 pr-4">
                                                        <div className="font-medium text-sm">{order.user_name || "—"}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {order.user_email || order.user_id.slice(0, 8) + "…"}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 pr-4 max-w-[140px] truncate">
                                                        {order.package_name || "—"}
                                                    </td>
                                                    <td className="py-2 pr-4 font-medium whitespace-nowrap">
                                                        {order.amount?.toLocaleString("tr-TR")} {order.currency}
                                                    </td>
                                                    <td className="py-2 pr-4 text-center font-medium">
                                                        {order.credits}
                                                    </td>
                                                    <td className="py-2 pr-4">
                                                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                                                            {order.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-4">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(order.created_at).toLocaleString("tr-TR")}
                                                    </td>
                                                    <td className="py-2">
                                                        {order.status === "pending" ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={completing === order.id}
                                                                onClick={() => handleComplete(order.id)}
                                                                className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                                                            >
                                                                {completing === order.id
                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                    : <CheckCircle className="w-3 h-3 mr-1" />
                                                                }
                                                                Onayla
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
