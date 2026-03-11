import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CreditCard,
  Building2,
  CheckCircle2,
  Check,
  Zap,
  ShoppingCart,
  Loader2,
  PackageOpen,
  Globe,
} from 'lucide-react';
import {
  getCreditPackages,
  getCheckoutProviders,
  createOrder,
  getOrders,
  type PaymentProvider,
} from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { tr as dateFnsTr, enUS } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────────────────────
type PaymentMethodUI = 'card' | 'bank_transfer';

interface OrderResult {
  orderId: string;
  paymentMethod: 'card' | 'bank_transfer';
  resolvedProvider?: string;
  iframeUrl?: string;
  paymentPageUrl?: string;
  redirectUrl?: string;
  sessionUrl?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

interface NormalizedPackage {
  id: string;
  name: string;
  displayName: string;
  credits: number;
  priceTry: number;
  priceUsd: number;
  description: string | null;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  isRecommended?: boolean;
}

// ─── Regional decision model ──────────────────────────────────────────────────
/**
 * Derive a conservative regional context from available checkout providers.
 *
 * Strategy:
 * - If the backend returns an enabled TR-region card provider (paytr/iyzico/shopier)
 *   → the user is served TRY-only; treat as Turkey context.
 * - If Stripe (global) is enabled → USD pricing can be shown, not Turkey context.
 * - If only bank_transfer is available → assume Turkey conservative fallback.
 * - Language hint used as secondary signal only when providers are ambiguous.
 *
 * This is conservative by design: we never show USD pricing unless Stripe is
 * confirmed enabled. We never mix TRY + USD on the same storefront.
 */
interface RegionCtx {
  isTurkeyContext: boolean;
  stripeEnabled: boolean;
  trCardEnabled: boolean;      // paytr/iyzico/shopier active
  bankTransferEnabled: boolean;
  bankTransferInfo: PaymentProvider | null;
  /** true only when stripe is enabled AND user is not in Turkey context */
  canShowUsdPricing: boolean;
  /** card payment available for the user's region */
  canUseCard: boolean;
}

function deriveRegionCtx(providers: PaymentProvider[], langHint: string): RegionCtx {
  const enabled = providers.filter(p => p.enabled);

  const stripeProvider = enabled.find(p => p.provider_code === 'stripe');
  const trCardProvider = enabled.find(
    p => ['paytr', 'iyzico', 'shopier'].includes(p.provider_code) && p.region === 'tr'
  );
  const bankProvider = enabled.find(p => p.provider_code === 'bank_transfer');

  const stripeEnabled      = !!stripeProvider;
  const trCardEnabled      = !!trCardProvider;
  const bankTransferEnabled = !!bankProvider;

  // Primary signal: explicit provider availability
  let isTurkeyContext: boolean;
  if (trCardEnabled && !stripeEnabled) {
    isTurkeyContext = true;           // only TR providers active
  } else if (stripeEnabled && !trCardEnabled) {
    isTurkeyContext = false;          // only global provider active
  } else if (trCardEnabled && stripeEnabled) {
    // Both active — use language as tiebreaker (conservative: default TR)
    isTurkeyContext = langHint.startsWith('tr');
  } else {
    // No card provider active — conservative fallback from language / bank presence
    isTurkeyContext = langHint.startsWith('tr') || bankTransferEnabled;
  }

  const canShowUsdPricing = stripeEnabled && !isTurkeyContext;
  const canUseCard        = isTurkeyContext ? trCardEnabled : stripeEnabled;

  return {
    isTurkeyContext,
    stripeEnabled,
    trCardEnabled,
    bankTransferEnabled,
    bankTransferInfo: bankProvider ?? null,
    canShowUsdPricing,
    canUseCard,
  };
}

// ─── Package helpers ──────────────────────────────────────────────────────────
function normalizePackage(raw: any, idx: number): NormalizedPackage {
  const features = (() => {
    const f = raw.features;
    if (Array.isArray(f)) return (f as string[]).filter(Boolean);
    if (typeof f === 'string' && f.trim())
      return f.split('\n').map((s: string) => s.trim()).filter(Boolean);
    return [];
  })();
  return {
    id:          raw.id ?? '',
    name:        raw.name ?? '',
    displayName: '',            // filled after localization
    credits:     raw.credits ?? 0,
    priceTry:    raw.price_try ?? raw.price ?? 0,
    priceUsd:    raw.price_usd ?? 0,
    description: raw.description ?? null,
    features,
    isActive:    raw.is_active ?? true,
    sortOrder:   raw.sort_order ?? idx,
  };
}

function localizedName(raw: any, lang: string): string {
  if (lang.startsWith('tr')) return raw.display_name_tr ?? raw.displayName ?? raw.name ?? '';
  return raw.display_name_en ?? raw.displayName ?? raw.name ?? '';
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function statusStyle(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'pending':   return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'failed':    return 'bg-red-100 text-red-700 border-red-200';
    default:          return 'bg-muted text-muted-foreground border-border';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'tr';

  const [rawPackages, setRawPackages]         = useState<any[]>([]);
  // Public providers omit secret fields — use a looser type so state accepts the real shape
  const [allProviders, setAllProviders]        = useState<Partial<PaymentProvider>[]>([]);
  const [orders, setOrders]                    = useState<any[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isLoadingPackages,  setIsLoadingPackages]  = useState(true);
  const [isLoadingOrders,    setIsLoadingOrders]    = useState(true);
  const [packagesError,      setPackagesError]      = useState<string | null>(null);
  const [ordersError,        setOrdersError]        = useState<string | null>(null);

  const [showPaymentDialog,    setShowPaymentDialog]    = useState(false);
  const [selectedPackage,      setSelectedPackage]      = useState<NormalizedPackage | null>(null);
  const [paymentMethod,        setPaymentMethod]        = useState<PaymentMethodUI>('card');
  const [isCreatingOrder,      setIsCreatingOrder]      = useState(false);
  const [orderError,           setOrderError]           = useState<string | null>(null);
  const [bankTransferResult,   setBankTransferResult]   = useState<OrderResult | null>(null);
  const [showBankTransferInfo, setShowBankTransferInfo] = useState(false);

  // ── Load providers (single call, drives all regional logic) ──────────────
  useEffect(() => {
    getCheckoutProviders()
      .then(d => setAllProviders(d.providers ?? []))
      .catch(() => setAllProviders([]))
      .finally(() => setIsLoadingProviders(false));
  }, []);

  useEffect(() => {
    getCreditPackages()
      .then(d => setRawPackages(d.packages ?? []))
      .catch(e => setPackagesError(e.message))
      .finally(() => setIsLoadingPackages(false));
  }, []);

  useEffect(() => {
    getOrders()
      .then(d => setOrders(d.orders ?? []))
      .catch(e => setOrdersError(e.message))
      .finally(() => setIsLoadingOrders(false));
  }, []);

  const refreshOrders = async () => {
    try { const d = await getOrders(); setOrders(d.orders ?? []); } catch {}
  };

  // ── Derive regional context ───────────────────────────────────────────────
  const region = useMemo<RegionCtx>(
    () => deriveRegionCtx(allProviders as PaymentProvider[], lang),
    [allProviders, lang]
  );

  // ── Normalize + filter packages ───────────────────────────────────────────
  const packages = useMemo<NormalizedPackage[]>(() => {
    if (isLoadingPackages || isLoadingProviders) return [];

    const norm = rawPackages
      .filter(p => p.is_active !== false)
      .map((p, i) => {
        const n = normalizePackage(p, i);
        n.displayName = localizedName(p, lang);
        return n;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Mark middle package as recommended
    if (norm.length === 1) norm[0].isRecommended = true;
    else if (norm.length >= 2) norm[Math.floor(norm.length / 2)].isRecommended = true;

    return norm;
  }, [rawPackages, lang, isLoadingPackages, isLoadingProviders]);

  // ── Price display ─────────────────────────────────────────────────────────
  const currencySymbol = region.isTurkeyContext ? '₺' : '$';
  const getDisplayPrice = (pkg: NormalizedPackage) =>
    region.isTurkeyContext ? pkg.priceTry : pkg.priceUsd;
  const fmtPrice = (n: number) =>
    n.toLocaleString(lang.startsWith('tr') ? 'tr-TR' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBuyClick = (pkg: NormalizedPackage) => {
    setSelectedPackage(pkg);
    setPaymentMethod(region.canUseCard ? 'card' : 'bank_transfer');
    setOrderError(null);
    setShowPaymentDialog(true);
  };

  const handleConfirmOrder = async () => {
    if (!selectedPackage) return;
    try {
      setIsCreatingOrder(true);
      setOrderError(null);
      const result = await createOrder(selectedPackage.id, paymentMethod) as OrderResult;
      if (result.paymentMethod === 'bank_transfer') {
        setBankTransferResult(result);
        setShowPaymentDialog(false);
        setShowBankTransferInfo(true);
        await refreshOrders();
        return;
      }
      const url = result.sessionUrl || result.redirectUrl || result.paymentPageUrl || result.iframeUrl;
      if (url) { window.location.href = url; return; }
      setShowPaymentDialog(false);
      await refreshOrders();
    } catch (error: any) {
      setOrderError(error.message || t('billing.orderFailed'));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const closeBankTransferInfo = () => {
    setShowBankTransferInfo(false);
    setBankTransferResult(null);
    setSelectedPackage(null);
  };

  const locale = lang.startsWith('tr') ? dateFnsTr : enUS;
  const isLoading = isLoadingPackages || isLoadingProviders;

  return (
    <div className="space-y-10 animate-fade-in max-w-5xl">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-xl">{t('billing.pageDescription')}</p>

        {/* Region + pricing context hint */}
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          {region.isTurkeyContext
            ? <><span>🇹🇷</span><span>TRY fiyatlandırma · Türkiye</span></>
            : <><Globe className="w-3 h-3" /><span>USD pricing · International</span></>
          }
        </div>
      </div>

      {/* ── Packages ─────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          {t('billing.packages')}
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        )}

        {packagesError && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive text-center">
            {t('billing.loadPackagesFailed')}
          </div>
        )}

        {!isLoading && !packagesError && packages.length === 0 && (
          <div className="rounded-2xl border bg-card p-14 text-center">
            <PackageOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">{t('billing.noPackagesInRegion')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('billing.contactSupport')}</p>
          </div>
        )}

        {!isLoading && !packagesError && packages.length > 0 && (
          <div className={`grid gap-5 ${
            packages.length === 1 ? 'max-w-xs'
            : packages.length === 2 ? 'sm:grid-cols-2 max-w-xl'
            : 'sm:grid-cols-3'
          }`}>
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
                  pkg.isRecommended
                    ? 'border-primary ring-1 ring-primary/20 shadow-[0_4px_20px_hsl(var(--primary)/0.1)] bg-primary/[0.02]'
                    : 'bg-card hover:shadow-sm'
                }`}
              >
                {/* Recommended pill */}
                {pkg.isRecommended && (
                  <div className="absolute -top-3 left-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shadow-sm">
                      <Zap className="w-2.5 h-2.5" />
                      {t('billing.popular')}
                    </span>
                  </div>
                )}

                {/* Name */}
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {pkg.displayName}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {currencySymbol}{fmtPrice(getDisplayPrice(pkg))}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {pkg.credits.toLocaleString()} {t('billing.credits')}
                </p>

                {/* Description */}
                {pkg.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4 border-t pt-3">
                    {pkg.description}
                  </p>
                )}

                {/* Features */}
                {pkg.features.length > 0 && (
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA */}
                <div className="mt-auto pt-2">
                  <Button
                    className="w-full gap-2 text-sm"
                    variant={pkg.isRecommended ? 'default' : 'outline'}
                    onClick={() => handleBuyClick(pkg)}
                    disabled={!region.canUseCard && !region.bankTransferEnabled}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {t('billing.buyNow')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Order history ────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          {t('billing.orderHistory')}
        </h3>

        {isLoadingOrders && (
          <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        )}

        {ordersError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t('billing.loadOrdersFailed')}
          </div>
        )}

        {!isLoadingOrders && !ordersError && orders.length === 0 && (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <ShoppingCart className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">{t('billing.noOrders')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('billing.noOrdersDesc')}</p>
          </div>
        )}

        {!isLoadingOrders && !ordersError && orders.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('billing.packageName')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('billing.amount')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">{t('billing.credits')}</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">{t('billing.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('billing.orderDate')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{order.packageName}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {order.currency === 'USD' ? '$' : '₺'}{Number(order.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{(order.credits ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusStyle(order.status)}`}>
                        {t(`billing.orderStatus.${order.status}`, { defaultValue: order.status })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.createdAt ?? order.created_at), { addSuffix: true, locale })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Payment method dialog ─────────────────────────────────────────── */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('billing.paymentDialogTitle')}</DialogTitle>
            {selectedPackage && (
              <DialogDescription>
                {selectedPackage.displayName} &mdash; {selectedPackage.credits.toLocaleString()} {t('billing.credits')}
                {' · '}
                <span className="font-semibold text-foreground">
                  {currencySymbol}{fmtPrice(getDisplayPrice(selectedPackage))}
                </span>
              </DialogDescription>
            )}
          </DialogHeader>

          <RadioGroup
            value={paymentMethod}
            onValueChange={v => setPaymentMethod(v as PaymentMethodUI)}
            className="space-y-2"
          >
            {/* Card — only when a card provider is available for this region */}
            {region.canUseCard && (
              <label
                htmlFor="pay-card"
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <RadioGroupItem value="card" id="pay-card" className="mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    {region.isTurkeyContext
                      ? <CreditCard className="w-4 h-4 text-primary shrink-0" />
                      : <Globe className="w-4 h-4 text-primary shrink-0" />
                    }
                    <span className="font-medium text-sm">{t('billing.paymentCard')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('billing.paymentCardDesc')}</p>
                </div>
              </label>
            )}

            {/* Bank transfer — Turkey-only, shown only when enabled */}
            {region.bankTransferEnabled && (
              <label
                htmlFor="pay-bank"
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <RadioGroupItem value="bank_transfer" id="pay-bank" className="mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">{t('billing.paymentBankTransfer')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('billing.paymentBankTransferDesc')}</p>
                </div>
              </label>
            )}
          </RadioGroup>

          {orderError && (
            <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">{orderError}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={isCreatingOrder}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={isCreatingOrder || (!region.canUseCard && !region.bankTransferEnabled)}
              className="gap-2"
            >
              {isCreatingOrder && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreatingOrder ? t('common.loading') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bank transfer result dialog ───────────────────────────────────── */}
      <Dialog open={showBankTransferInfo} onOpenChange={closeBankTransferInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              {t('billing.orderReceived')}
            </DialogTitle>
            <DialogDescription>{t('billing.bankTransferInstructions')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-muted/50 border p-4 space-y-2 font-medium">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                {t('billing.paymentBankTransfer')}
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground font-normal">{t('billing.orderNumber')}</span>
                <span className="font-mono">{bankTransferResult?.orderId}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground font-normal">{t('billing.amount')}</span>
                <span>
                  {bankTransferResult?.currency === 'TRY' ? '₺' : '$'}{bankTransferResult?.amount}
                </span>
              </p>
              {region.bankTransferInfo?.bank_name && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground font-normal">{t('billing.bankLabel')}</span>
                  <span>{region.bankTransferInfo.bank_name}</span>
                </p>
              )}
              {region.bankTransferInfo?.account_holder && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground font-normal">{t('billing.accountHolder')}</span>
                  <span>{region.bankTransferInfo.account_holder}</span>
                </p>
              )}
              {region.bankTransferInfo?.iban && (
                <p className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground font-normal">{t('billing.ibanLabel')}</span>
                  <span className="font-mono text-xs break-all tracking-wide">{region.bankTransferInfo.iban}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground font-normal mt-1">
                {region.bankTransferInfo?.payment_note || t('billing.bankTransferOrderNote')}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
              {t('billing.bankTransferPending')}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={closeBankTransferInfo}>{t('billing.understood')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
