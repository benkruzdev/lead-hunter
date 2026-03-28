import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
    Loader2, Search, ExternalLink, ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";
import { getAdminUsers, updateAdminUser } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AdminUser {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(dt: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// RoleBadge: uses shared StatusBadge with semantic variants
function RoleBadge({ role }: { role: string }) {
    return (
        <StatusBadge variant={role === "admin" ? "info" : "neutral"}>
            {role === "admin" ? "Admin" : "Kullanıcı"}
        </StatusBadge>
    );
}

// UserStatusBadge: uses shared StatusBadge
function UserStatusBadge({ status }: { status: boolean }) {
    return (
        <StatusBadge variant={status ? "success" : "danger"}>
            {status ? "Aktif" : "Pasif"}
        </StatusBadge>
    );
}

// PlanBadge: domain-specific, kept page-local
function PlanBadge({ plan }: { plan: string }) {
    return (
        <Badge variant="outline" className="text-xs">
            {plan}
        </Badge>
    );
}

// ---------------------------------------------------------------------------
// Quick Edit Dialog
// ---------------------------------------------------------------------------
function EditUserDialog({
    user,
    onClose,
}: {
    user: AdminUser;
    onClose: () => void;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        plan: user.plan,
        credits: String(user.credits),
        status: user.status ? "active" : "inactive",
        role: user.role,
    });

    const mutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => updateAdminUser(user.id, data),
        onSuccess: () => {
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
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Kullanıcı Düzenle</DialogTitle>
                    <DialogDescription className="truncate text-xs">{user.email || user.id}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
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
                        <Input
                            type="number"
                            min="0"
                            value={form.credits}
                            onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                        />
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
// Page
// ---------------------------------------------------------------------------
const PAGE_SIZE = 25;

export default function AdminUsersPage() {
    const { t } = useTranslation();
    const [searchInput, setSearchInput] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [page, setPage] = useState(0);
    const [editUser, setEditUser] = useState<AdminUser | null>(null);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["adminUsers", activeQuery, page],
        queryFn: () => getAdminUsers({ query: activeQuery || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    });

    const users = data?.users || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setActiveQuery(searchInput);
    };

    const userColumns: ColumnDef<AdminUser>[] = [
        {
            key: "user",
            header: "Kullanici",
            render: (user) => (
                <Link to={`/app/admin/users/${user.id}`} className="hover:underline">
                    <div className="font-medium leading-tight truncate max-w-[160px]">{user.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{user.email || "—"}</div>
                </Link>
            ),
        },
        { key: "phone", header: "Telefon", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => user.phone || "—" },
        { key: "role", header: "Rol", render: (user) => <RoleBadge role={user.role} /> },
        { key: "plan", header: "Plan", render: (user) => <PlanBadge plan={user.plan} /> },
        { key: "credits", header: "Kredi", className: "font-medium tabular-nums", render: (user) => user.credits.toLocaleString() },
        { key: "status", header: "Durum", render: (user) => <UserStatusBadge status={user.status} /> },
        { key: "last_sign_in_at", header: "Son Giris", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => fmtDate(user.last_sign_in_at) },
        { key: "last_login_ip", header: "IP", className: "text-xs font-mono text-muted-foreground whitespace-nowrap", render: (user) => user.last_login_ip || "—" },
        { key: "created_at", header: "Kayit", className: "text-xs text-muted-foreground whitespace-nowrap", render: (user) => new Date(user.created_at).toLocaleDateString("tr-TR") },
        {
            key: "actions",
            header: "",
            render: (user) => (
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditUser(user as AdminUser)}>Duzenle</Button>
                    <Link to={`/app/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="w-3 h-3" /></Button>
                    </Link>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("admin.users.title")}
                description={t("admin.users.description")}
                actions={
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="E-posta, ad, telefon…"
                                value={searchInput}
                                onChange={e => { setSearchInput(e.target.value); }}
                                className="pl-9 w-60"
                            />
                        </div>
                        <Button type="submit" variant="outline">Ara</Button>
                    </form>
                }
            />

            {/* Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center py-12 gap-2 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                    <p className="text-sm">{t("admin.users.loadFailed")}</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>{t("common.retry")}</Button>
                </div>
            ) : users.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Kullanıcı bulunamadı.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                        Toplam {total.toLocaleString()} kullanıcı
                    </div>
                    <DataTable<AdminUser>
                        columns={userColumns}
                        data={users}
                        getRowKey={(u) => u.id}
                    />

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-1">
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
                </div>
            )}

            {/* Edit Dialog */}
            {editUser && <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />}
        </div>
    );
}
