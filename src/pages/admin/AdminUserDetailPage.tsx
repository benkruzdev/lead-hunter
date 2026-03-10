import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Loader2, ArrowLeft, User, Mail, Phone, Shield, Calendar, Search,
    FileDown, CreditCard, Activity, Wallet, Clock, AlertCircle, Edit,
} from "lucide-react";
import { getAdminUser, getAdminUserActivity, updateAdminUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDatetime(dt: string | null) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("tr-TR");
}
function fmtDate(dt: string | null) {
    if (!dt) return "—";
    return new Date(dt).toLocaleDateString("tr-TR");
}
function fmtRel(dt: string | null) {
    if (!dt) return "—";
    const diff = Date.now() - new Date(dt).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Az önce";
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} gün önce`;
    return fmtDate(dt);
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b last:border-0">
            <span className="text-muted-foreground text-sm min-w-36">{label}</span>
            <span className={`text-sm font-medium flex-1 break-all ${mono ? "font-mono text-xs" : ""}`}>
                {value ?? "—"}
            </span>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
            <div className="text-muted-foreground">{icon}</div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{value}</p>
            </div>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{children}</h3>;
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
            <p className="text-sm">{label}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TABS = [
    { id: "general",  label: "Genel",           icon: <User className="w-4 h-4" /> },
    { id: "activity", label: "Aktiviteler",     icon: <Activity className="w-4 h-4" /> },
    { id: "payments", label: "Ödemeler",        icon: <Wallet className="w-4 h-4" /> },
    { id: "ledger",   label: "Kredi Hareketleri", icon: <CreditCard className="w-4 h-4" /> },
] as const;

type TabId = typeof TABS[number]["id"];

// ---------------------------------------------------------------------------
// Edit Dialog
// ---------------------------------------------------------------------------
interface User {
    id: string;
    email: string | null;
    full_name: string;
    phone: string | null;
    plan: string;
    credits: number;
    status: boolean;
    role: string;
    created_at: string;
    updated_at: string | null;
    last_sign_in_at: string | null;
    last_login_ip: string | null;
}

function EditDialog({ user, onClose }: { user: User; onClose: () => void }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        full_name: user.full_name || "",
        phone: user.phone || "",
        plan: user.plan,
        credits: String(user.credits),
        status: user.status ? "active" : "inactive",
        role: user.role,
    });

    const mutation = useMutation({
        mutationFn: (data: any) => updateAdminUser(user.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminUser", user.id] });
            queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
            toast({ title: "Kullanıcı güncellendi" });
            onClose();
        },
        onError: () => {
            toast({ title: "Güncelleme başarısız", variant: "destructive" });
        },
    });

    const handleSave = () => {
        const creditsNum = Number(form.credits);
        if (!Number.isFinite(creditsNum) || creditsNum < 0) return;
        mutation.mutate({
            plan: form.plan,
            credits: Math.trunc(creditsNum),
            status: form.status === "active",
            role: form.role,
        });
    };

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Kullanıcı Düzenle</DialogTitle>
                    <DialogDescription className="text-xs truncate">{user.email || user.id}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    {/* Read-only fields */}
                    <div className="rounded-lg bg-muted/30 border p-3 space-y-1 text-xs text-muted-foreground">
                        <div>User ID: <span className="font-mono">{user.id}</span></div>
                        <div>E-posta: <span className="font-medium text-foreground">{user.email || "—"}</span></div>
                        <div>Oluşturulma: {fmtDate(user.created_at)}</div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Plan</label>
                        <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="solo">Solo</SelectItem>
                                <SelectItem value="team">Team</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Kredi</label>
                        <Input type="number" min="0" value={form.credits}
                            onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Durum</label>
                        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Aktif</SelectItem>
                                <SelectItem value="inactive">Pasif</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Rol</label>
                        <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">Kullanıcı</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>İptal</Button>
                    <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Tab: Genel
// ---------------------------------------------------------------------------
function TabGeneral({ user }: { user: User }) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4" /> Profil
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <InfoRow label="Ad Soyad" value={user.full_name || "—"} />
                    <InfoRow label="E-posta" value={user.email || "—"} />
                    <InfoRow label="Telefon" value={user.phone || "—"} />
                    <InfoRow label="User ID" value={user.id} mono />
                    <InfoRow label="Rol" value={
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            user.role === "admin"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>{user.role === "admin" ? "Admin" : "Kullanıcı"}</span>
                    } />
                    <InfoRow label="Durum" value={
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            user.status
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        }`}>{user.status ? "Aktif" : "Pasif"}</span>
                    } />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Oturum & Plan
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <InfoRow label="Kayıt Tarihi" value={fmtDate(user.created_at)} />
                    <InfoRow label="Son Güncelleme" value={fmtDate(user.updated_at)} />
                    <InfoRow label="Son Giriş" value={fmtDatetime(user.last_sign_in_at)} />
                    <InfoRow label="Son IP" value={user.last_login_ip || "—"} mono />
                    <InfoRow label="Plan" value={<Badge variant="outline">{user.plan}</Badge>} />
                    <InfoRow label="Kredi" value={
                        <span className="font-bold text-base">{user.credits.toLocaleString()}</span>
                    } />
                </CardContent>
            </Card>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab: Aktiviteler
// ---------------------------------------------------------------------------
function TabActivity({ userId }: { userId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["adminUserActivity", userId],
        queryFn: () => getAdminUserActivity(userId),
    });

    if (isLoading) return (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    );
    if (error) return (
        <div className="flex flex-col items-center py-8 gap-2 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm">Aktivite yüklenemedi</p>
        </div>
    );
    if (!data) return null;

    const { stats, recent_searches, recent_exports } = data;

    return (
        <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<Search className="w-5 h-5" />} label="Toplam Arama" value={stats.total_searches} />
                <StatCard icon={<Clock className="w-5 h-5" />} label="Son 30 Gün" value={stats.searches_30d} />
                <StatCard icon={<FileDown className="w-5 h-5" />} label="Toplam Export" value={stats.total_exports} />
                <StatCard icon={<Activity className="w-5 h-5" />} label="Bekleyen Ödeme" value={stats.pending_orders} />
            </div>

            {/* Timeline */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Son Aramalar */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Search className="w-4 h-4" /> Son Aramalar
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recent_searches.length === 0 ? (
                            <EmptyState icon={<Search className="w-6 h-6" />} label="Henüz arama yok." />
                        ) : (
                            <div className="space-y-2">
                                {recent_searches.map(s => (
                                    <div key={s.id} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
                                        <div className="text-sm">
                                            <span className="font-medium">
                                                {[s.province, s.district].filter(Boolean).join(" / ") || "—"}
                                            </span>
                                            <span className="text-muted-foreground ml-1 text-xs">
                                                {s.category || s.keyword || ""}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                            {fmtRel(s.created_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Son Exportlar */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileDown className="w-4 h-4" /> Son Exportlar
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recent_exports.length === 0 ? (
                            <EmptyState icon={<FileDown className="w-6 h-6" />} label="Henüz export yok." />
                        ) : (
                            <div className="space-y-2">
                                {recent_exports.map(e => (
                                    <div key={e.id} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
                                        <div className="text-sm">
                                            <span className="font-medium">{e.list_name || "—"}</span>
                                            <span className="text-muted-foreground ml-1 text-xs">
                                                {e.format.toUpperCase()} · {e.lead_count} lead
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                            {fmtRel(e.created_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Last timestamps */}
            <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                    { label: "Son Arama", val: stats.last_search_at },
                    { label: "Son Export", val: stats.last_export_at },
                    { label: "Son Ödeme", val: stats.last_order_at },
                    { label: "Son Kredi", val: stats.last_credit_at },
                ].map(({ label, val }) => (
                    <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{fmtRel(val)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab: Ödemeler
// ---------------------------------------------------------------------------
function TabPayments({ userId }: { userId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["adminUserActivity", userId],
        queryFn: () => getAdminUserActivity(userId),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    if (error) return <div className="text-center py-8 text-destructive text-sm">Yüklenemedi</div>;

    const orders = data?.recent_orders || [];
    const STATUS_CLS: Record<string, string> = {
        completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        failed:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
    const STATUS_LABEL: Record<string, string> = { completed: "Tamamlandı", pending: "Bekliyor", failed: "Başarısız", cancelled: "İptal" };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Son Ödemeler (5)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <EmptyState icon={<Wallet className="w-6 h-6" />} label="Ödeme kaydı yok." />
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground text-xs">
                                <th className="pb-2 pr-3 font-medium">Paket</th>
                                <th className="pb-2 pr-3 font-medium">Tutar</th>
                                <th className="pb-2 pr-3 font-medium">Yöntem</th>
                                <th className="pb-2 pr-3 font-medium">Durum</th>
                                <th className="pb-2 font-medium">Tarih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {orders.map(o => (
                                <tr key={o.id}>
                                    <td className="py-2 pr-3">{o.package_name || "—"}</td>
                                    <td className="py-2 pr-3 font-medium tabular-nums whitespace-nowrap">
                                        {o.amount.toLocaleString("tr-TR")} {o.currency}
                                    </td>
                                    <td className="py-2 pr-3 text-xs text-muted-foreground">{o.payment_method}</td>
                                    <td className="py-2 pr-3">
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[o.status] || ""}`}>
                                            {STATUS_LABEL[o.status] || o.status}
                                        </span>
                                    </td>
                                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtRel(o.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Tab: Kredi Hareketleri
// ---------------------------------------------------------------------------
function TabLedger({ userId }: { userId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["adminUserActivity", userId],
        queryFn: () => getAdminUserActivity(userId),
    });

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    if (error) return <div className="text-center py-8 text-destructive text-sm">Yüklenemedi</div>;

    const ledger = data?.recent_ledger || [];

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Son Kredi Hareketleri (10)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {ledger.length === 0 ? (
                    <EmptyState icon={<CreditCard className="w-6 h-6" />} label="Kredi hareketi yok." />
                ) : (
                    <div className="space-y-1">
                        {ledger.map(entry => (
                            <div key={entry.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                                <span className={`text-sm font-bold tabular-nums min-w-14 ${entry.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {entry.amount >= 0 ? "+" : ""}{entry.amount.toLocaleString()}
                                </span>
                                <div className="flex-1 text-sm">
                                    <span className="font-medium">{entry.type}</span>
                                    {entry.description && <span className="text-muted-foreground ml-1 text-xs">— {entry.description}</span>}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtRel(entry.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminUserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [tab, setTab] = useState<TabId>("general");
    const [showEdit, setShowEdit] = useState(false);

    const { data: user, isLoading, error, refetch } = useQuery({
        queryKey: ["adminUser", id],
        queryFn: () => getAdminUser(id!),
        enabled: !!id,
    });

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    if (error || !user) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Kullanıcı yüklenemedi.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Tekrar Dene</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link to="/app/admin/users">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Kullanıcılar
                    </Button>
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold truncate">{user.full_name || "—"}</h1>
                    <p className="text-muted-foreground text-sm truncate">{user.email || user.id}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.status
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                        {user.status ? "Aktif" : "Pasif"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === "admin"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                        {user.role === "admin" ? "Admin" : "Kullanıcı"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
                        <Edit className="w-3 h-3 mr-1" /> Düzenle
                    </Button>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <Badge variant="outline" className="mt-1">{user.plan}</Badge>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Kredi</p>
                    <p className="font-bold text-lg">{user.credits.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Son Giriş</p>
                    <p className="text-sm font-medium">{fmtRel(user.last_sign_in_at)}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b">
                <div className="flex gap-1">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                tab === t.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div>
                {tab === "general"  && <TabGeneral user={user as User} />}
                {tab === "activity" && <TabActivity userId={id!} />}
                {tab === "payments" && <TabPayments userId={id!} />}
                {tab === "ledger"   && <TabLedger userId={id!} />}
            </div>

            {/* Edit dialog */}
            {showEdit && <EditDialog user={user as User} onClose={() => setShowEdit(false)} />}
        </div>
    );
}
