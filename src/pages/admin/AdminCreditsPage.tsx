import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, AlertCircle, Plus, Minus, RefreshCw, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminCreditsLedger, adjustAdminUserCredits, getAdminUsers } from "@/lib/api";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 50;

interface Transaction {
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    amount: number;
    type: string;
    description: string | null;
    created_at: string;
}

interface UserOption {
    id: string;
    full_name: string | null;
    email: string;
    credits: number;
}

export default function AdminCreditsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();

    // ── Ledger state ──────────────────────────────────────────────────
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totalTx, setTotalTx] = useState(0);
    const [txPage, setTxPage] = useState(0);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerError, setLedgerError] = useState<string | null>(null);

    // ── Manual adjust state ───────────────────────────────────────────
    // Store the full selected user object — avoids fragile users.find() after debounce overwrites list
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
    const [adjustUserSearch, setAdjustUserSearch] = useState("");
    const [adjustAmount, setAdjustAmount] = useState("");
    const [adjustDesc, setAdjustDesc] = useState("");
    const [adjusting, setAdjusting] = useState(false);
    const [searchResults, setSearchResults] = useState<UserOption[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // ── Load ledger ───────────────────────────────────────────────────
    const loadLedger = useCallback(async (page: number) => {
        setLedgerLoading(true);
        setLedgerError(null);
        try {
            const result = await getAdminCreditsLedger({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
            setTransactions(result.transactions);
            setTotalTx(result.total);
        } catch (err: any) {
            setLedgerError(err.message || "Kredi hareketleri yüklenemedi");
        } finally {
            setLedgerLoading(false);
        }
    }, []);

    useEffect(() => { loadLedger(txPage); }, [txPage, loadLedger]);

    // ── Debounced user search ─────────────────────────────────────────
    useEffect(() => {
        // Don't search if a user is already selected (search box shows their label)
        if (selectedUser) return;
        if (!adjustUserSearch.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const result = await getAdminUsers({ query: adjustUserSearch.trim(), limit: 20, offset: 0 });
                setSearchResults((result.users || []).map((u: any) => ({
                    id: u.id,
                    full_name: u.full_name || null,
                    email: u.email || "",
                    credits: u.credits || 0,
                })));
                setShowDropdown(true);
            } catch {
                setSearchResults([]);
                setShowDropdown(false);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [adjustUserSearch, selectedUser]);

    // ── Select a user from dropdown ───────────────────────────────────
    const selectUser = (u: UserOption) => {
        setSelectedUser(u);
        setAdjustUserSearch("");
        setSearchResults([]);
        setShowDropdown(false);
    };

    const clearSelection = () => {
        setSelectedUser(null);
        setAdjustUserSearch("");
        setSearchResults([]);
        setShowDropdown(false);
    };

    // ── Adjust submit ─────────────────────────────────────────────────
    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) { toast({ title: "Kullanıcı seçin", variant: "destructive" }); return; }
        const amt = parseInt(adjustAmount);
        if (!amt) { toast({ title: "Geçerli bir miktar girin", variant: "destructive" }); return; }
        setAdjusting(true);
        try {
            const result = await adjustAdminUserCredits({
                user_id: selectedUser.id,  // always profiles.id, never email
                amount: amt,
                description: adjustDesc || undefined,
            });
            toast({ title: `Kredi güncellendi: ${result.previous_balance} → ${result.new_balance}` });
            // Refresh selected user's displayed balance
            setSelectedUser(prev => prev ? { ...prev, credits: result.new_balance } : null);
            setAdjustAmount("");
            setAdjustDesc("");
            loadLedger(0);
            setTxPage(0);
        } catch (err: any) {
            toast({ title: err.message || "İşlem başarısız", variant: "destructive" });
        } finally {
            setAdjusting(false);
        }
    };

    const totalPages = Math.ceil(totalTx / PAGE_SIZE);

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.credits.title')}</h1>
                <p className="text-muted-foreground">{t('admin.credits.description')}</p>
            </div>

            {/* ── Manual Credit Adjustment ─────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        {t('admin.credits.manual.title')}
                    </CardTitle>
                    <CardDescription>Herhangi bir kullanıcının kredi bakiyesini artır veya azalt</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdjust} className="space-y-4 max-w-lg">

                        {/* ── User picker ── */}
                        <div className="space-y-2">
                            <Label>Kullanıcı</Label>

                            {/* Show selected user chip OR search input */}
                            {selectedUser ? (
                                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/40">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-sm">
                                            {selectedUser.full_name || selectedUser.email}
                                        </span>
                                        {selectedUser.full_name && (
                                            <span className="ml-2 text-xs text-muted-foreground">{selectedUser.email}</span>
                                        )}
                                        <span className="ml-2 text-xs text-primary font-semibold">{selectedUser.credits} kredi</span>
                                    </div>
                                    <button type="button" onClick={clearSelection}
                                        className="text-muted-foreground hover:text-foreground flex-shrink-0">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Input
                                        placeholder="Email veya isim ile ara…"
                                        value={adjustUserSearch}
                                        onChange={e => setAdjustUserSearch(e.target.value)}
                                        autoComplete="off"
                                    />
                                    {searchLoading && (
                                        <div className="absolute right-2 top-2.5">
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                    {showDropdown && searchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-md divide-y max-h-52 overflow-y-auto">
                                            {searchResults.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2"
                                                    onClick={() => selectUser(u)}
                                                >
                                                    <span>
                                                        <span className="font-medium">{u.full_name || u.email}</span>
                                                        {u.full_name && (
                                                            <span className="ml-2 text-muted-foreground text-xs">{u.email}</span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-primary flex-shrink-0">{u.credits} kredi</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showDropdown && !searchLoading && searchResults.length === 0 && adjustUserSearch.trim() && (
                                        <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-md px-3 py-3 text-sm text-muted-foreground">
                                            Kullanıcı bulunamadı
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Amount ── */}
                        <div className="space-y-2">
                            <Label htmlFor="adjust-amount">Miktar (+ ekle / − düş)</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="icon"
                                    onClick={() => setAdjustAmount(v => String((parseInt(v) || 0) - 10))}>
                                    <Minus className="w-4 h-4" />
                                </Button>
                                <Input
                                    id="adjust-amount"
                                    type="number"
                                    placeholder="örn. 50 veya -20"
                                    value={adjustAmount}
                                    onChange={e => setAdjustAmount(e.target.value)}
                                    className="flex-1"
                                />
                                <Button type="button" variant="outline" size="icon"
                                    onClick={() => setAdjustAmount(v => String((parseInt(v) || 0) + 10))}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* ── Description ── */}
                        <div className="space-y-2">
                            <Label htmlFor="adjust-desc">Açıklama (opsiyonel)</Label>
                            <Input
                                id="adjust-desc"
                                placeholder="örn. Promosyon kredisi"
                                value={adjustDesc}
                                onChange={e => setAdjustDesc(e.target.value)}
                            />
                        </div>

                        <Button type="submit" disabled={adjusting || !selectedUser}>
                            {adjusting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Uygula
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* ── Credit Ledger ─────────────────────────────────────── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            {t('admin.credits.ledger.title')}
                        </CardTitle>
                        <CardDescription>Tüm kullanıcılara ait kredi hareketleri — toplam {totalTx.toLocaleString()}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => loadLedger(txPage)} disabled={ledgerLoading}>
                        <RefreshCw className={`w-4 h-4 ${ledgerLoading ? "animate-spin" : ""}`} />
                    </Button>
                </CardHeader>
                <CardContent>
                    {ledgerLoading && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {ledgerError && (
                        <div className="flex flex-col items-center py-10 gap-2 text-destructive">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{ledgerError}</p>
                        </div>
                    )}
                    {!ledgerLoading && !ledgerError && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="pb-2 pr-4 font-medium">Kullanıcı</th>
                                            <th className="pb-2 pr-4 font-medium">Miktar</th>
                                            <th className="pb-2 pr-4 font-medium">Tür</th>
                                            <th className="pb-2 pr-4 font-medium">Açıklama</th>
                                            <th className="pb-2 font-medium">Tarih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {transactions.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                                                    Kayıt bulunamadı
                                                </td>
                                            </tr>
                                        )}
                                        {transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-muted/40">
                                                <td className="py-2 pr-4">
                                                    <div className="font-medium">{tx.user_name || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {tx.user_email || tx.user_id.slice(0, 8) + "…"}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                                                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{tx.type}</span>
                                                </td>
                                                <td className="py-2 pr-4 text-muted-foreground max-w-xs truncate">
                                                    {tx.description || "—"}
                                                </td>
                                                <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">
                                                    {new Date(tx.created_at).toLocaleString("tr-TR")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        Sayfa {txPage + 1} / {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={txPage === 0}
                                            onClick={() => setTxPage(p => p - 1)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={txPage >= totalPages - 1}
                                            onClick={() => setTxPage(p => p + 1)}>
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
