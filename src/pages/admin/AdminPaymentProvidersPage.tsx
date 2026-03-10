import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CreditCard, Globe, Lock } from "lucide-react";
import {
    getAdminPaymentProviders,
    upsertAdminPaymentProvider,
    PaymentProvider,
    PaymentProviderUpdate,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Static provider metadata (display only — region is enforced server-side)
// ---------------------------------------------------------------------------
const PROVIDER_META: Record<string, { label: string; region: 'tr' | 'global'; currencyHint: string }> = {
    paytr:   { label: 'PayTR',   region: 'tr',     currencyHint: 'TRY' },
    iyzico:  { label: 'iyzico',  region: 'tr',     currencyHint: 'TRY' },
    shopier: { label: 'Shopier', region: 'tr',     currencyHint: 'TRY' },
    stripe:  { label: 'Stripe',  region: 'global', currencyHint: 'USD, EUR' },
};

const MASK = '••••••••';

// ---------------------------------------------------------------------------
// ProviderCard
// ---------------------------------------------------------------------------
function ProviderCard({ provider }: { provider: PaymentProvider }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const meta = PROVIDER_META[provider.provider_code];

    const [form, setForm] = useState<PaymentProviderUpdate>({
        display_name:         provider.display_name,
        enabled:              provider.enabled,
        mode:                 provider.mode,
        supported_currencies: provider.supported_currencies,
        merchant_id:          provider.merchant_id ?? '',
        api_key:              provider.api_key ?? '',
        secret_key:           provider.secret_key ?? '',   // already masked by backend
        public_key:           provider.public_key ?? '',
        webhook_secret:       provider.webhook_secret ?? '', // already masked
        sort_order:           provider.sort_order,
    });

    const mutation = useMutation({
        mutationFn: (data: PaymentProviderUpdate) =>
            upsertAdminPaymentProvider(provider.provider_code, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPaymentProviders'] });
            toast({ title: `${meta.label} ayarları kaydedildi` });
        },
        onError: (err: any) => {
            toast({ title: err.message || 'Kayıt başarısız', variant: 'destructive' });
        },
    });

    const handleSave = () => {
        mutation.mutate(form);
    };

    const set = (key: keyof PaymentProviderUpdate, value: unknown) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleCurrencies = (raw: string) =>
        set('supported_currencies', raw.split(',').map(s => s.trim()).filter(Boolean));

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-base">{meta.label}</CardTitle>
                            <CardDescription className="flex items-center gap-1 mt-0.5">
                                {meta.region === 'global'
                                    ? <Globe className="w-3 h-3" />
                                    : <span className="text-xs font-medium">🇹🇷</span>
                                }
                                <span className="text-xs">
                                    {meta.region === 'global' ? 'Global (Uluslararası)' : 'Türkiye'}
                                    {' · '}{meta.currencyHint}
                                </span>
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Label htmlFor={`enabled-${provider.provider_code}`} className="text-sm">
                            {form.enabled ? 'Aktif' : 'Pasif'}
                        </Label>
                        <Switch
                            id={`enabled-${provider.provider_code}`}
                            checked={!!form.enabled}
                            onCheckedChange={v => set('enabled', v)}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Mode */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">Mod</Label>
                    <div className="flex gap-2">
                        {(['test', 'live'] as const).map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => set('mode', m)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                                    form.mode === m
                                        ? m === 'live'
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-yellow-500 text-white border-yellow-500'
                                        : 'border-input text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                {m === 'test' ? 'Test' : 'Canlı (Live)'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Supported currencies */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">Para Birimleri</Label>
                    <Input
                        value={(form.supported_currencies ?? []).join(', ')}
                        onChange={e => handleCurrencies(e.target.value)}
                        placeholder="TRY, USD, EUR"
                        className="max-w-sm"
                    />
                </div>

                {/* Merchant ID */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">Merchant ID</Label>
                    <Input
                        value={form.merchant_id ?? ''}
                        onChange={e => set('merchant_id', e.target.value)}
                        placeholder="İsteğe bağlı"
                        className="max-w-sm"
                    />
                </div>

                {/* API Key */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">API Key</Label>
                    <Input
                        value={form.api_key ?? ''}
                        onChange={e => set('api_key', e.target.value)}
                        placeholder="Yayınlanabilir anahtar"
                        className="max-w-sm"
                    />
                </div>

                {/* Public Key */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">Public Key</Label>
                    <Input
                        value={form.public_key ?? ''}
                        onChange={e => set('public_key', e.target.value)}
                        placeholder="İsteğe bağlı"
                        className="max-w-sm"
                    />
                </div>

                {/* Secret Key — always masked display */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Secret Key
                    </Label>
                    <Input
                        type="password"
                        value={form.secret_key ?? ''}
                        onChange={e => set('secret_key', e.target.value)}
                        placeholder={MASK}
                        className="max-w-sm"
                        autoComplete="new-password"
                    />
                    <span className="text-xs text-muted-foreground">Boş bırakınca mevcut değer korunur</span>
                </div>

                {/* Webhook Secret — always masked display */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Webhook Secret
                    </Label>
                    <Input
                        type="password"
                        value={form.webhook_secret ?? ''}
                        onChange={e => set('webhook_secret', e.target.value)}
                        placeholder={MASK}
                        className="max-w-sm"
                        autoComplete="new-password"
                    />
                    <span className="text-xs text-muted-foreground">Boş bırakınca mevcut değer korunur</span>
                </div>

                {/* Sort order */}
                <div className="flex items-center gap-4">
                    <Label className="w-40 shrink-0 text-sm">Sıralama</Label>
                    <Input
                        type="number"
                        min={0}
                        value={form.sort_order ?? 0}
                        onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                        className="w-24"
                    />
                </div>

                <div className="pt-2">
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Kaydet
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminPaymentProvidersPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['adminPaymentProviders'],
        queryFn: getAdminPaymentProviders,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 text-destructive">
                <AlertCircle className="w-10 h-10" />
                <p className="text-sm">{(error as any).message || 'Ödeme sağlayıcıları yüklenemedi.'}</p>
            </div>
        );
    }

    const providers = data?.providers ?? [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">Ödeme Sağlayıcıları</h1>
                <p className="text-muted-foreground mt-1">
                    Her sağlayıcı için credential ve mod ayarlarını yönetin.
                    Secret alanlar şifrelenmiş şekilde saklanır ve burada asla tam olarak gösterilmez.
                </p>
            </div>

            {/* Region legend */}
            <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <span>🇹🇷</span> Türkiye ödemeleri: PayTR · iyzico · Shopier
                </span>
                <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Uluslararası ödemeler: Stripe
                </span>
            </div>

            {providers.length === 0 ? (
                <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
            ) : (
                <div className="space-y-4">
                    {providers.map(p => (
                        <ProviderCard key={p.provider_code} provider={p} />
                    ))}
                </div>
            )}
        </div>
    );
}
