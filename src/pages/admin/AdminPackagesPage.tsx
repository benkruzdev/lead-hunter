import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, X, Save, Loader2, Package } from "lucide-react";
import {
    getAdminPackages,
    createAdminPackage,
    updateAdminPackage,
    deleteAdminPackage,
    type AdminCreditPackage,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
    name: "",
    display_name_tr: "",
    display_name_en: "",
    credits: "",
    price_try: "",
    price_usd: "",
    sort_order: "0",
    is_active: true,
    description: "",
    features: "",   // newline-separated list in textarea
};

type FormData = typeof EMPTY_FORM;

function packageToForm(pkg: AdminCreditPackage): FormData {
    return {
        name: pkg.name,
        display_name_tr: pkg.display_name_tr,
        display_name_en: pkg.display_name_en,
        credits: String(pkg.credits),
        price_try: String(pkg.price_try),
        price_usd: String(pkg.price_usd),
        sort_order: String(pkg.sort_order),
        is_active: pkg.is_active,
        description: pkg.description || "",
        features: (pkg.features || []).join("\n"),
    };
}

export default function AdminPackagesPage() {
    const { toast } = useToast();

    const [packages, setPackages] = useState<AdminCreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAdminPackages();
            setPackages(res.packages);
        } catch (e: any) {
            setError(e.message || "Failed to load packages");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function openEdit(pkg: AdminCreditPackage) {
        setEditingId(pkg.id);
        setForm(packageToForm(pkg));
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    function handleField(key: keyof FormData, value: string | boolean) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        if (!form.name.trim() || !form.display_name_tr.trim() || !form.display_name_en.trim()) {
            toast({ title: "Eksik alan", description: "İsim alanları zorunludur.", variant: "destructive" });
            return;
        }
        const payload = {
            name: form.name.trim(),
            display_name_tr: form.display_name_tr.trim(),
            display_name_en: form.display_name_en.trim(),
            credits: parseInt(form.credits) || 0,
            price_try: parseFloat(form.price_try) || 0,
            price_usd: parseFloat(form.price_usd) || 0,
            sort_order: parseInt(form.sort_order) || 0,
            is_active: form.is_active,
            description: form.description.trim() || null,
            features: form.features.trim()
                ? form.features.split("\n").map(f => f.trim()).filter(Boolean)
                : null,
        };
        setSaving(true);
        try {
            if (editingId) {
                await updateAdminPackage(editingId, payload);
                toast({ title: "Paket güncellendi" });
            } else {
                await createAdminPackage(payload);
                toast({ title: "Paket oluşturuldu" });
            }
            closeForm();
            load();
        } catch (e: any) {
            toast({ title: "Hata", description: e.message || "İşlem başarısız", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(pkg: AdminCreditPackage) {
        try {
            await updateAdminPackage(pkg.id, { is_active: !pkg.is_active });
            setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p));
        } catch (e: any) {
            toast({ title: "Hata", description: e.message, variant: "destructive" });
        }
    }

    async function handleDelete(pkg: AdminCreditPackage) {
        if (!window.confirm(`"${pkg.display_name_tr}" paketini silmek istediğinize emin misiniz?\nSipariş varsa silinmez — pasif yapabilirsiniz.`)) return;
        setDeletingId(pkg.id);
        try {
            await deleteAdminPackage(pkg.id);
            toast({ title: "Paket silindi" });
            load();
        } catch (e: any) {
            toast({ title: "Silinemedi", description: e.message, variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    }

    async function handleReorder(pkg: AdminCreditPackage, dir: "up" | "down") {
        const sorted = [...packages].sort((a, b) => a.sort_order - b.sort_order);
        const idx = sorted.findIndex(p => p.id === pkg.id);
        const swapIdx = dir === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const swapPkg = sorted[swapIdx];
        const aOrder = pkg.sort_order;
        const bOrder = swapPkg.sort_order;

        try {
            await Promise.all([
                updateAdminPackage(pkg.id, { sort_order: bOrder }),
                updateAdminPackage(swapPkg.id, { sort_order: aOrder }),
            ]);
            setPackages(prev => prev.map(p => {
                if (p.id === pkg.id) return { ...p, sort_order: bOrder };
                if (p.id === swapPkg.id) return { ...p, sort_order: aOrder };
                return p;
            }));
        } catch (e: any) {
            toast({ title: "Sıralama hatası", description: e.message, variant: "destructive" });
        }
    }

    const sorted = [...packages].sort((a, b) => a.sort_order - b.sort_order);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Paket Yönetimi</h2>
                    <p className="text-muted-foreground text-sm mt-1">Kredi paketleri oluştur, düzenle, sırala ve aktif/pasif yap.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Paket
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Yükleniyor...
                </div>
            )}

            {/* Empty */}
            {!loading && !error && packages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <Package className="w-10 h-10 opacity-40" />
                    <p className="text-sm">Henüz kredi paketi oluşturulmamış.</p>
                    <button onClick={openCreate} className="text-primary text-sm underline underline-offset-4">İlk paketi oluştur</button>
                </div>
            )}

            {/* Table */}
            {!loading && sorted.length > 0 && (
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paket</th>
                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Kredi</th>
                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fiyat TRY</th>
                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fiyat USD</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Durum</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sıra</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((pkg, idx) => (
                                <tr key={pkg.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{pkg.display_name_tr}</div>
                                        <div className="text-xs text-muted-foreground">{pkg.display_name_en} · <code className="font-mono">{pkg.name}</code></div>
                                        {pkg.description && (
                                            <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{pkg.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-medium">{pkg.credits.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono">₺{Number(pkg.price_try).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-mono">${Number(pkg.price_usd).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggleActive(pkg)}
                                            title={pkg.is_active ? "Aktif — tıkla pasif yap" : "Pasif — tıkla aktif yap"}
                                            className="transition-colors"
                                        >
                                            {pkg.is_active
                                                ? <ToggleRight className="w-6 h-6 text-green-500" />
                                                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                                            }
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleReorder(pkg, "up")}
                                                disabled={idx === 0}
                                                className="p-1 rounded hover:bg-muted disabled:opacity-30"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleReorder(pkg, "down")}
                                                disabled={idx === sorted.length - 1}
                                                className="p-1 rounded hover:bg-muted disabled:opacity-30"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => openEdit(pkg)}
                                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                title="Düzenle"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pkg)}
                                                disabled={deletingId === pkg.id}
                                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                                title="Sil (sipariş varsa engellenir)"
                                            >
                                                {deletingId === pkg.id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Trash2 className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Slide-in Form Panel */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div className="flex-1 bg-black/40" onClick={closeForm} />
                    {/* Panel */}
                    <div className="w-full max-w-lg bg-background border-l shadow-xl flex flex-col overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h3 className="font-semibold text-lg">
                                {editingId ? "Paketi Düzenle" : "Yeni Paket"}
                            </h3>
                            <button onClick={closeForm} className="p-1.5 rounded hover:bg-muted">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 p-6 space-y-5">
                            {/* Internal name */}
                            <Field label="Dahili Ad (name)" required>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => handleField("name", e.target.value)}
                                    placeholder="starter"
                                    className="field-input font-mono"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Veritabanı unique key. Küçük harf, tire ok. Kısalt.</p>
                            </Field>

                            {/* Display names */}
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Görünen Ad (TR)" required>
                                    <input
                                        type="text"
                                        value={form.display_name_tr}
                                        onChange={e => handleField("display_name_tr", e.target.value)}
                                        placeholder="Başlangıç"
                                        className="field-input"
                                    />
                                </Field>
                                <Field label="Görünen Ad (EN)" required>
                                    <input
                                        type="text"
                                        value={form.display_name_en}
                                        onChange={e => handleField("display_name_en", e.target.value)}
                                        placeholder="Starter"
                                        className="field-input"
                                    />
                                </Field>
                            </div>

                            {/* Credits */}
                            <Field label="Kredi Miktarı" required>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.credits}
                                    onChange={e => handleField("credits", e.target.value)}
                                    placeholder="1000"
                                    className="field-input"
                                />
                            </Field>

                            {/* Prices */}
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Fiyat (TRY ₺)" required>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.price_try}
                                        onChange={e => handleField("price_try", e.target.value)}
                                        placeholder="99.00"
                                        className="field-input"
                                    />
                                </Field>
                                <Field label="Fiyat (USD $)" required>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.price_usd}
                                        onChange={e => handleField("price_usd", e.target.value)}
                                        placeholder="10.00"
                                        className="field-input"
                                    />
                                </Field>
                            </div>

                            {/* Sort order + Active */}
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Sıra">
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.sort_order}
                                        onChange={e => handleField("sort_order", e.target.value)}
                                        className="field-input"
                                    />
                                </Field>
                                <Field label="Durum">
                                    <div className="flex items-center gap-3 h-10">
                                        <button
                                            type="button"
                                            onClick={() => handleField("is_active", !form.is_active)}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            {form.is_active
                                                ? <ToggleRight className="w-6 h-6 text-green-500" />
                                                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                                            }
                                            {form.is_active ? "Aktif" : "Pasif"}
                                        </button>
                                    </div>
                                </Field>
                            </div>

                            {/* Description */}
                            <Field label="Açıklama (opsiyonel)">
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => handleField("description", e.target.value)}
                                    placeholder="Küçük ekipler için ideal başlangıç paketi"
                                    className="field-input"
                                />
                            </Field>

                            {/* Features */}
                            <Field label="Özellikler (satır satır, opsiyonel)">
                                <textarea
                                    rows={4}
                                    value={form.features}
                                    onChange={e => handleField("features", e.target.value)}
                                    placeholder={"1.000 kredi\nArama başına 10 kredi\nÜcretsiz zenginleştirme"}
                                    className="field-input resize-none"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Her satır ayrı bir özellik olarak kaydedilir.</p>
                            </Field>
                        </div>

                        <div className="px-6 py-4 border-t flex justify-end gap-3">
                            <button onClick={closeForm} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingId ? "Güncelle" : "Oluştur"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .field-input {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    border: 1px solid hsl(var(--border));
                    background: hsl(var(--background));
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.15s;
                }
                .field-input:focus {
                    border-color: hsl(var(--primary));
                    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
                }
            `}</style>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">
                {label}{required && <span className="text-destructive ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}
