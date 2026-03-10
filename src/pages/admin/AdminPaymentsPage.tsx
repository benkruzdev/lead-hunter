import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
    Wallet, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Eye, Building2, CreditCard,
} from "lucide-react";
import { getAdminPayments, completeAdminOrder, rejectAdminOrder } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Static maps
// ---------------------------------------------------------------------------
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    pending:   { label: "Bekliyor",    cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    completed: { label: "Tamamlandı", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    failed:    { label: "Başarısız",  cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { label: "İptal",      cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const METHOD_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
    bank_transfer: { label: "IBAN / Havale", icon: <Building2 className="w-3 h-3" /> },
    manual:        { label: "Manuel",        icon: <Building2 className="w-3 h-3" /> },
    paytr:         { label: "PayTR",         icon: <CreditCard className="w-3 h-3" /> },
    iyzico:        { label: "iyzico",        icon: <CreditCard className="w-3 h-3" /> },
    shopier:       { label: "Shopier",       icon: <CreditCard className="w-3 h-3" /> },
    stripe:        { label: "Stripe",        icon: <CreditCard className="w-3 h-3" /> },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shortId(id: string) {
    return "#" + id.replace(/-/g, "").slice(0, 8);
}

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
            {s.label}
        </span>
    );
}

function MethodBadge({ method }: { method: string }) {
    const m = METHOD_MAP[method] ?? { label: method, icon: <CreditCard className="w-3 h-3" /> };
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-medium">
            {m.icon}
            {m.label}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Detail Section helper
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">{children}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0 w-36">{label}</span>
            <span className="text-right font-medium break-all">{value}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Order interface
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------
function OrderDetailModal({
    order,
    onClose,
    onComplete,
    onReject,
    completing,
    rejecting,
}: {
    order: Order;
    onClose: () => void;
    onComplete: (id: string) => void;
    onReject: (id: string) => void;
    completing: string | null;
    rejecting: string | null;
}) {
    const isPending = order.status === "pending";
    const isBankTransfer = order.payment_method === "bank_transfer" || order.payment_method === "manual";

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        Sipariş Detayı
                        <span className="font-mono text-sm text-muted-foreground">
                            {shortId(order.id)}
                        </span>
                    </DialogTitle>
                    <DialogDescription>
                        <StatusBadge status={order.status} />
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Sipariş Bilgisi */}
                    <Section title="Sipariş Bilgisi">
                        <Row label="Sipariş No"
                            value={
                                <span className="font-mono text-xs break-all">{order.id}</span>
                            }
                        />
                        <Row label="Oluşturulma"
                            value={new Date(order.created_at).toLocaleString("tr-TR")}
                        />
                        <Row label="Durum" value={<StatusBadge status={order.status} />} />
                        <Row label="Ödeme Yöntemi" value={<MethodBadge method={order.payment_method} />} />
                    </Section>

                    {/* Müşteri Bilgisi */}
                    <Section title="Müşteri">
                        <Row label="Ad Soyad" value={order.user_name || "—"} />
                        <Row label="E-posta" value={order.user_email || "—"} />
                        <Row label="User ID"
                            value={<span className="font-mono text-xs">{order.user_id}</span>}
                        />
                    </Section>

                    {/* Paket Bilgisi */}
                    <Section title="Paket">
                        <Row label="Paket" value={order.package_name || "—"} />
                        <Row label="Kredi" value={`${order.credits.toLocaleString()} kredi`} />
                        <Row label="Tutar"
                            value={`${order.amount?.toLocaleString("tr-TR")} ${order.currency}`}
                        />
                    </Section>

                    {/* Havale özelinde ek bilgi */}
                    {isBankTransfer && (
                        <Section title="Havale / IBAN Ödemesi">
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                Bu sipariş IBAN / Havale yöntemiyle oluşturulmuştur.
                                Kullanıcı ödemeyi banka havalesiyle gerçekleştirmeyi kabul etmiştir.
                                Ödeme dekontu geldiğinde aşağıdan onaylayabilirsiniz.
                            </div>
                        </Section>
                    )}
                </div>

                {/* Admin actions */}
                {isPending && (
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                            disabled={rejecting === order.id || completing === order.id}
                            onClick={() => onReject(order.id)}
                        >
                            {rejecting === order.id
                                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                : <XCircle className="w-3 h-3 mr-1" />
                            }
                            Reddet
                        </Button>
                        <Button
                            size="sm"
                            className="text-white bg-green-600 hover:bg-green-700"
                            disabled={completing === order.id || rejecting === order.id}
                            onClick={() => onComplete(order.id)}
                        >
                            {completing === order.id
                                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                : <CheckCircle2 className="w-3 h-3 mr-1" />
                            }
                            Onayla
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminPaymentsPage() {
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
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
            toast({ title: `Sipariş onaylandı — ${result.credits_added} kredi eklendi` });
            setSelectedOrder(null);
            loadOrders(page, activeQuery, statusFilter);
        } catch (err: any) {
            toast({ title: err.message || "İşlem başarısız", variant: "destructive" });
        } finally {
            setCompleting(null);
        }
    };

    const handleReject = async (orderId: string) => {
        setRejecting(orderId);
        try {
            await rejectAdminOrder(orderId);
            toast({ title: "Sipariş reddedildi" });
            setSelectedOrder(null);
            loadOrders(page, activeQuery, statusFilter);
        } catch (err: any) {
            toast({ title: err.message || "İşlem başarısız", variant: "destructive" });
        } finally {
            setRejecting(null);
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Ödemeler</h1>
                <p className="text-muted-foreground">Sipariş listesi ve havale onay yönetimi</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            Siparişler
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
                                            <th className="pb-2 pr-3 font-medium">Sipariş No</th>
                                            <th className="pb-2 pr-3 font-medium">Kullanıcı</th>
                                            <th className="pb-2 pr-3 font-medium">Paket</th>
                                            <th className="pb-2 pr-3 font-medium">Tutar</th>
                                            <th className="pb-2 pr-3 font-medium">Yöntem</th>
                                            <th className="pb-2 pr-3 font-medium">Durum</th>
                                            <th className="pb-2 pr-3 font-medium">Tarih</th>
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
                                        {orders.map(order => (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-muted/40 cursor-pointer"
                                                onClick={() => setSelectedOrder(order)}
                                            >
                                                {/* Sipariş No */}
                                                <td className="py-2 pr-3">
                                                    <span
                                                        className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                        title={order.id}
                                                    >
                                                        {shortId(order.id)}
                                                    </span>
                                                </td>
                                                {/* Kullanıcı */}
                                                <td className="py-2 pr-3">
                                                    <div className="font-medium text-sm leading-tight">
                                                        {order.user_name || "—"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                                                        {order.user_email || order.user_id.slice(0, 8) + "…"}
                                                    </div>
                                                </td>
                                                {/* Paket */}
                                                <td className="py-2 pr-3 max-w-[120px] truncate text-sm">
                                                    {order.package_name || "—"}
                                                </td>
                                                {/* Tutar */}
                                                <td className="py-2 pr-3 font-medium whitespace-nowrap text-sm">
                                                    {order.amount?.toLocaleString("tr-TR")} {order.currency}
                                                </td>
                                                {/* Yöntem */}
                                                <td className="py-2 pr-3">
                                                    <MethodBadge method={order.payment_method} />
                                                </td>
                                                {/* Durum */}
                                                <td className="py-2 pr-3">
                                                    <StatusBadge status={order.status} />
                                                </td>
                                                {/* Tarih */}
                                                <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(order.created_at).toLocaleString("tr-TR")}
                                                </td>
                                                {/* Aksiyon */}
                                                <td className="py-2" onClick={e => e.stopPropagation()}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <Eye className="w-3 h-3 mr-1" />
                                                        Detay
                                                    </Button>
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

            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onComplete={handleComplete}
                    onReject={handleReject}
                    completing={completing}
                    rejecting={rejecting}
                />
            )}
        </div>
    );
}
