import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, BarChart3, Trash2, RefreshCw, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    getAdminCacheStats,
    getAdminQueryCache,
    deleteAdminQueryCacheEntry,
    deleteAdminQueryCache,
    getAdminPlaceCache,
    deleteAdminPlaceCacheEntry,
    deleteAdminPlaceCache,
    type QueryCacheEntry,
    type PlaceCacheEntry,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
    const expired = isExpired(expiresAt);
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${expired
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-green-50 text-green-700 border-green-200"
            }`}>
            {expired ? "Süresi dolmuş" : formatDate(expiresAt)}
        </span>
    );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: string;
    count?: number;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

function ConfirmDialog({ open, title, description, count, onConfirm, onCancel, loading }: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={o => !o && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="space-y-2 pt-1">
                        {count !== undefined && (
                            <span className="font-medium text-foreground">
                                {count} kayıt silinecek.
                            </span>
                        )}
                        {description && <span className="block">{description}</span>}
                        <span className="block text-destructive font-medium">
                            Bu işlem geri alınamaz.
                        </span>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} disabled={loading}>
                        İptal
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                        Sil
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Cache Stats Panel ────────────────────────────────────────────────────────

function CacheStats() {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["admin-cache-stats"],
        queryFn: getAdminCacheStats,
        refetchInterval: 30_000,
    });

    const stats = [
        { label: "Sorgu Cache", value: data?.query_cache_count ?? "—", sub: `${data?.query_cache_expired ?? 0} süresi dolmuş` },
        { label: "Place Cache", value: data?.place_cache_count ?? "—", sub: `${data?.place_cache_expired ?? 0} süresi dolmuş` },
        { label: "Sorgu Hit", value: data?.total_query_hits ?? "—", sub: "Toplam cache kullanımı" },
        { label: "Place Hit", value: data?.total_place_hits ?? "—", sub: "Toplam place servis" },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cache İstatistikleri</h3>
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(s => (
                    <div key={s.label} className="rounded-xl border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.sub}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Query Cache Tab ──────────────────────────────────────────────────────────

function QueryCacheTab() {
    const qc = useQueryClient();
    const [selected, setSelected] = useState<string[]>([]);
    const [confirm, setConfirm] = useState<{ mode: "single" | "selected" | "expired" | "all"; key?: string } | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["admin-query-cache"],
        queryFn: () => getAdminQueryCache({ limit: 100 }),
    });

    const entries: QueryCacheEntry[] = data?.entries || [];

    // Reconcile selection: remove IDs no longer in the visible entry list
    useEffect(() => {
        const validKeys = new Set(entries.map(e => e.query_key));
        setSelected(prev => prev.filter(k => validKeys.has(k)));
    }, [entries]);

    const invalidateMutation = useMutation({
        mutationFn: async () => {
            if (!confirm) return;
            if (confirm.mode === "single" && confirm.key) {
                return deleteAdminQueryCacheEntry(confirm.key);
            }
            return deleteAdminQueryCache({
                mode: confirm.mode === "selected" ? "selected" : confirm.mode === "expired" ? "expired" : "all",
                keys: confirm.mode === "selected" ? selected : undefined,
            });
        },
        onSuccess: () => {
            setConfirm(null);
            setSelected([]);
            qc.invalidateQueries({ queryKey: ["admin-query-cache"] });
            qc.invalidateQueries({ queryKey: ["admin-cache-stats"] });
        },
    });

    function toggleSelect(key: string) {
        setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    function toggleAll() {
        setSelected(prev => prev.length === entries.length ? [] : entries.map(e => e.query_key));
    }

    const expiredCount = entries.filter(e => isExpired(e.expires_at)).length;

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                    Yenile
                </Button>
                <Button
                    variant="outline" size="sm"
                    disabled={selected.length === 0}
                    onClick={() => setConfirm({ mode: "selected" })}
                >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Seçili Sil ({selected.length})
                </Button>
                <Button
                    variant="outline" size="sm"
                    disabled={expiredCount === 0}
                    onClick={() => setConfirm({ mode: "expired" })}
                >
                    Süresi Dolmuşları Temizle ({expiredCount})
                </Button>
                <Button
                    variant="destructive" size="sm"
                    disabled={entries.length === 0}
                    onClick={() => setConfirm({ mode: "all" })}
                >
                    Tümünü Temizle
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">{entries.length} kayıt</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40">
                            <th className="p-3 w-10">
                                <button onClick={toggleAll}>
                                    {selected.length === entries.length && entries.length > 0
                                        ? <CheckSquare className="w-4 h-4" />
                                        : <Square className="w-4 h-4 text-muted-foreground" />}
                                </button>
                            </th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Şehir</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">İlçe</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Kategori</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Keyword</th>
                            <th className="p-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">Sonuç</th>
                            <th className="p-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">Hit</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Bitiş</th>
                            <th className="p-3 w-10" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Yükleniyor…</td></tr>
                        )}
                        {!isLoading && entries.length === 0 && (
                            <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Cache boş</td></tr>
                        )}
                        {entries.map(e => (
                            <tr key={e.query_key} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="p-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(e.query_key)}
                                        onChange={() => toggleSelect(e.query_key)}
                                        className="rounded border-muted-foreground"
                                    />
                                </td>
                                <td className="p-3 font-medium">{e.province || "—"}</td>
                                <td className="p-3 text-muted-foreground">{e.district || "—"}</td>
                                <td className="p-3 text-muted-foreground max-w-[140px] truncate">{e.category || "—"}</td>
                                <td className="p-3 text-muted-foreground">{e.keyword || "—"}</td>
                                <td className="p-3 text-right tabular-nums">{e.total_results}</td>
                                <td className="p-3 text-right tabular-nums">{e.hit_count}</td>
                                <td className="p-3"><ExpiryBadge expiresAt={e.expires_at} /></td>
                                <td className="p-3">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                        onClick={() => setConfirm({ mode: "single", key: e.query_key })}>
                                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!confirm}
                title={confirm?.mode === "all" ? "Tüm sorgu cache'ini temizle" :
                    confirm?.mode === "expired" ? "Süresi dolmuşları temizle" :
                        confirm?.mode === "selected" ? "Seçili kayıtları sil" : "Kaydı sil"}
                count={confirm?.mode === "selected" ? selected.length :
                    confirm?.mode === "expired" ? expiredCount :
                        confirm?.mode === "all" ? entries.length : undefined}
                description="Bağlı sayfa cache kayıtları da silinir."
                onConfirm={() => invalidateMutation.mutate()}
                onCancel={() => setConfirm(null)}
                loading={invalidateMutation.isPending}
            />
        </div>
    );
}

// ─── Place Cache Tab ──────────────────────────────────────────────────────────

function PlaceCacheTab() {
    const qc = useQueryClient();
    const [selected, setSelected] = useState<string[]>([]);
    const [confirm, setConfirm] = useState<{ mode: "single" | "selected" | "expired" | "all"; id?: string } | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["admin-place-cache"],
        queryFn: () => getAdminPlaceCache({ limit: 100 }),
    });

    const entries: PlaceCacheEntry[] = data?.entries || [];

    // Reconcile selection: remove IDs no longer in the visible entry list
    useEffect(() => {
        const validIds = new Set(entries.map(e => e.place_id));
        setSelected(prev => prev.filter(id => validIds.has(id)));
    }, [entries]);

    const invalidateMutation = useMutation({
        mutationFn: async () => {
            if (!confirm) return;
            if (confirm.mode === "single" && confirm.id) {
                return deleteAdminPlaceCacheEntry(confirm.id);
            }
            return deleteAdminPlaceCache({
                mode: confirm.mode === "selected" ? "selected" : confirm.mode === "expired" ? "expired" : "all",
                ids: confirm.mode === "selected" ? selected : undefined,
            });
        },
        onSuccess: () => {
            setConfirm(null);
            setSelected([]);
            qc.invalidateQueries({ queryKey: ["admin-place-cache"] });
            qc.invalidateQueries({ queryKey: ["admin-cache-stats"] });
        },
    });

    function toggleSelect(id: string) {
        setSelected(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
    }

    function toggleAll() {
        setSelected(prev => prev.length === entries.length ? [] : entries.map(e => e.place_id));
    }

    const expiredCount = entries.filter(e => isExpired(e.expires_at)).length;

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                    Yenile
                </Button>
                <Button
                    variant="outline" size="sm"
                    disabled={selected.length === 0}
                    onClick={() => setConfirm({ mode: "selected" })}
                >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Seçili Sil ({selected.length})
                </Button>
                <Button
                    variant="outline" size="sm"
                    disabled={expiredCount === 0}
                    onClick={() => setConfirm({ mode: "expired" })}
                >
                    Süresi Dolmuşları Temizle ({expiredCount})
                </Button>
                <Button
                    variant="destructive" size="sm"
                    disabled={entries.length === 0}
                    onClick={() => setConfirm({ mode: "all" })}
                >
                    Tümünü Temizle
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">{entries.length} kayıt</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40">
                            <th className="p-3 w-10">
                                <button onClick={toggleAll}>
                                    {selected.length === entries.length && entries.length > 0
                                        ? <CheckSquare className="w-4 h-4" />
                                        : <Square className="w-4 h-4 text-muted-foreground" />}
                                </button>
                            </th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">İşletme</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Telefon</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Website</th>
                            <th className="p-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">Hit</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">Bitiş</th>
                            <th className="p-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide min-w-[180px]">Place ID</th>
                            <th className="p-3 w-10" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Yükleniyor…</td></tr>
                        )}
                        {!isLoading && entries.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Cache boş</td></tr>
                        )}
                        {entries.map(e => (
                            <tr key={e.place_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="p-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(e.place_id)}
                                        onChange={() => toggleSelect(e.place_id)}
                                        className="rounded border-muted-foreground"
                                    />
                                </td>
                                <td className="p-3 font-medium max-w-[180px] truncate">{e.name || "—"}</td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{e.phone || "—"}</td>
                                <td className="p-3 text-muted-foreground max-w-[140px] truncate text-xs">{e.website || "—"}</td>
                                <td className="p-3 text-right tabular-nums">{e.hit_count}</td>
                                <td className="p-3"><ExpiryBadge expiresAt={e.expires_at} /></td>
                                <td className="p-3 text-muted-foreground text-xs font-mono truncate max-w-[180px]">{e.place_id}</td>
                                <td className="p-3">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                        onClick={() => setConfirm({ mode: "single", id: e.place_id })}>
                                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!confirm}
                title={confirm?.mode === "all" ? "Tüm place cache'ini temizle" :
                    confirm?.mode === "expired" ? "Süresi dolmuşları temizle" :
                        confirm?.mode === "selected" ? "Seçili kayıtları sil" : "Kaydı sil"}
                count={confirm?.mode === "selected" ? selected.length :
                    confirm?.mode === "expired" ? expiredCount :
                        confirm?.mode === "all" ? entries.length : undefined}
                onConfirm={() => invalidateMutation.mutate()}
                onCancel={() => setConfirm(null)}
                loading={invalidateMutation.isPending}
            />
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCachePage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">Cache Yönetimi</h1>
                    <p className="text-sm text-muted-foreground">
                        Platform geneli shared cache — Google Places çağrılarını minimize eder
                    </p>
                </div>
            </div>

            {/* Stats always visible */}
            <CacheStats />

            {/* Tabs for query vs place cache */}
            <Tabs defaultValue="queries">
                <TabsList>
                    <TabsTrigger value="queries" className="flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4" />
                        Sorgu Cache
                    </TabsTrigger>
                    <TabsTrigger value="places" className="flex items-center gap-1.5">
                        <Database className="w-4 h-4" />
                        Place Cache
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="queries" className="mt-4">
                    <QueryCacheTab />
                </TabsContent>

                <TabsContent value="places" className="mt-4">
                    <PlaceCacheTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
