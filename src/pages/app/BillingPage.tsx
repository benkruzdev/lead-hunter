import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
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
  AlertCircle,
  XCircle,
  Clock,
  Info,
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
  isFeatured: boolean;  // only true when admin explicitly set is_featured
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
    // Explicit admin flag — defensive: support both casing, default false if absent
    isFeatured:  !!(raw.is_featured ?? raw.isFeatured ?? false),
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
  const { credits: currentCredits } = useAuth();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');

  const [rawPackages, setRawPackages]         = useState<any[]>([]);
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

    // No implicit badge — isFeatured is read directly from raw data in normalizePackage.

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

  const handleDismissBanner = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    setSearchParams(nextParams, { replace: true });
  };



  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">

      {/* ── Post-Payment Result Banner ───────────────────────────────────────── */}
      {paymentStatus && (
        <div className={`relative px-4 py-3 rounded-lg border shadow-sm flex items-start gap-3 ${
          paymentStatus === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800' :
          paymentStatus === 'cancelled' ? 'bg-muted/50 text-muted-foreground border-border' :
          'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {paymentStatus === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" /> :
           paymentStatus === 'cancelled' ? <Info className="w-5 h-5 mt-0.5 shrink-0" /> :
           <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
          
          <div className="flex-1 text-sm font-medium pt-0.5">
            {paymentStatus === 'success' && (lang.startsWith('tr') ? 'Ödemeniz alındı veya onay sürecindedir. Lütfen sipariş geçmişinizden güncel durumu kontrol edin.' : 'Payment received or is processing. Please review your order history below for the latest status.')}
            {paymentStatus === 'cancelled' && (lang.startsWith('tr') ? 'Ödeme işlemi iptal edildi.' : 'Payment process was cancelled.')}
            {paymentStatus === 'failed' && (lang.startsWith('tr') ? 'Ödeme reddedildi veya başarısız oldu. Lütfen tekrar deneyin.' : 'Payment failed or was declined. Please try again.')}
            {paymentStatus === 'error' && (lang.startsWith('tr') ? 'Ödeme sırasında sistemsel bir sorun oluştu.' : 'A system error occurred during payment.')}
          </div>
          
          <button onClick={handleDismissBanner} className="text-current/60 hover:text-current transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-8">
        <div className="flex items-start justify-between gap-6 mb-7">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2.5">
              {lang.startsWith('tr') ? 'Kredi Satın Al' : 'Purchase Credits'}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-sm">
              {lang.startsWith('tr')
                ? 'Tüm paketlerde aynı LeadHunter deneyimine erişirsiniz. Tek fark satın alınan kredi miktarıdır.'
                : 'All packages include the same LeadHunter experience. The only difference is how many credits you purchase.'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 border rounded-full px-3 py-1.5">
              {region.isTurkeyContext
                ? <><span>🇹🇷</span><span className="font-medium">TRY · Türkiye</span></>
                : <><Globe className="w-3 h-3" /><span className="font-medium">USD · International</span></>
              }
            </div>
            {currentCredits !== null && currentCredits !== undefined && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-xl px-4 py-2 mt-1">
                 <Zap className="w-4 h-4" />
                 <div className="flex flex-col text-right">
                   <span className="font-bold text-sm leading-none">{currentCredits.toLocaleString()} {t('billing.credits', 'cr')}</span>
                   <span className="text-[10px] font-medium opacity-80 mt-0.5 uppercase tracking-wide">
                     {lang.startsWith('tr') ? 'Mevcut Bakiye' : 'Current Balance'}
                   </span>
                 </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-5 border-t">
          {[
            lang.startsWith('tr') ? 'Tüm paketlerde aynı erişim' : 'Same access in every package',
            lang.startsWith('tr') ? 'Şeffaf ve adil ücretlendirme' : 'Transparent, fair billing',
            lang.startsWith('tr') ? 'Gizli plan farkı yok' : 'No hidden plan differences',
          ].map((label, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Packages ──────────────────────────────────────────────────────────── */}
      <section>
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
          <>
            <div className={`grid gap-6 sm:gap-8 ${
              packages.length === 1 ? 'grid-cols-1 max-w-sm mx-auto'
              : packages.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col rounded-3xl border transition-all duration-300 ${
                    pkg.isFeatured
                      ? 'border-primary shadow-2xl shadow-primary/10 bg-card ring-1 ring-primary/20 scale-100 lg:scale-[1.02] z-10'
                      : 'bg-card border-border/80 hover:border-primary/30 hover:shadow-lg'
                  }`}
                >
                  <div className="flex flex-col flex-1 p-7">
                    {/* Featured badge */}
                    {pkg.isFeatured && (
                      <div className="flex justify-center mb-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tracking-wide border border-primary/20">
                          <Zap className="w-3 h-3" />
                          {t('billing.popular')}
                        </span>
                      </div>
                    )}

                    {/* Package name */}
                    <p className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${
                      pkg.isFeatured ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {pkg.displayName}
                    </p>

                    {/* Price */}
                    <div className="mb-3">
                      <span className="text-[2.75rem] font-extrabold tracking-tight leading-none">
                        {currencySymbol}{fmtPrice(getDisplayPrice(pkg))}
                      </span>
                    </div>

                    {/* Credits */}
                    <p className="text-sm">
                      <span className="font-bold">{pkg.credits.toLocaleString()}</span>
                      <span className="text-muted-foreground ml-1">{t('billing.credits')}</span>
                    </p>

                    {/* Admin-managed description / Features */}
                    <div className="flex-1 flex flex-col gap-3 mt-4">
                      {pkg.description && (
                         <p className="text-sm text-foreground/80 font-medium leading-relaxed">
                           {pkg.description}
                         </p>
                      )}
                      
                      {pkg.features.length > 0 ? (
                        <ul className="space-y-3 mt-2 text-sm text-muted-foreground flex-1">
                          {pkg.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                               <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>

                    {/* CTA */}
                    <div className="mt-8 pt-6 border-t border-border/50">
                      <Button
                        className={`w-full gap-2 transition-all ${pkg.isFeatured ? 'h-11 shadow-md hover:shadow-lg' : 'h-11'}`}
                        variant={pkg.isFeatured ? 'default' : 'outline'}
                        onClick={() => handleBuyClick(pkg)}
                        disabled={!region.canUseCard && !region.bankTransferEnabled}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {t('billing.buyNow')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* How credits work — trust footer, part of the purchase surface */}
            <div className="mt-8 pt-6 border-t grid grid-cols-2 gap-x-10 gap-y-3">
              {(lang.startsWith('tr') ? [
                'Yalnızca yeni açılan işletme kayıtları kredi kullanır.',
                'Daha önce gördüğünüz sayfalar tekrar ücretlendirilmez.',
                'Son sayfada yalnızca gelen kayıt adedince kredi düşer.',
                'Sonuç yoksa hiç kredi kullanılmaz.',
              ] : [
                'Only newly revealed business records consume credits.',
                'Pages you have already viewed are never charged again.',
                'Partial last pages are charged only for records returned.',
                'Zero results means zero credits used.',
              ]).map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
                  <span className="text-xs text-muted-foreground leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Order history ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5 pb-3 border-b">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('billing.orderHistory')}
          </h3>
        </div>

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
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">{t('billing.packageName')}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">{t('billing.amount')}</th>
                    <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">{t('billing.credits')}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">{t('billing.status')}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">{t('billing.orderDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-sm mb-0.5">{order.packageName}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="truncate max-w-[120px]" title={order.id}>{order.id.split('-')[0]}</span>
                          {order.providerReference && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate max-w-[100px]" title={order.providerReference}>Ref: {order.providerReference}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 tabular-nums text-sm font-medium whitespace-nowrap">
                        {order.currency === 'USD' ? '$' : '₺'}{Number(order.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-sm font-bold text-foreground whitespace-nowrap">
                        {(order.credits ?? 0).toLocaleString()} <span className="text-muted-foreground font-normal text-xs ml-0.5">cr</span>
                      </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle(order.status)}`}>
                          {order.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {order.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                          {order.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                          {t(`billing.orderStatus.${order.status}`, { defaultValue: order.status })}
                        </span>
                        {order.status === 'failed' && order.failureReason && (
                          <span className="text-[10px] text-red-600/80 font-medium max-w-[180px] leading-tight" title={order.failureReason}>
                            {order.failureReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-muted-foreground whitespace-nowrap">
                      {new Date(order.createdAt ?? order.created_at).toLocaleDateString(lang.startsWith('tr') ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Payment method dialog ─────────────────────────────────────────────── */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm sm:max-w-md p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">{t('billing.paymentDialogTitle')}</DialogTitle>
          </DialogHeader>

          {selectedPackage && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between mb-6 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <div className="font-semibold text-foreground tracking-tight">{selectedPackage.displayName}</div>
                <div className="text-sm text-muted-foreground">{selectedPackage.credits.toLocaleString()} {t('billing.credits')}</div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-primary">
                {currencySymbol}{fmtPrice(getDisplayPrice(selectedPackage))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">{t('billing.paymentMethod', 'Ödeme Yöntemi')}</h4>
            <RadioGroup
              value={paymentMethod}
              onValueChange={v => setPaymentMethod(v as PaymentMethodUI)}
              className="space-y-3"
            >
              {region.canUseCard && (
                <label
                  htmlFor="pay-card"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'card' ? 'border-primary bg-primary/[0.03] shadow-sm' : 'border-transparent bg-muted/40 hover:bg-muted/60'
                  }`}
                >
                  <RadioGroupItem value="card" id="pay-card" className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {region.isTurkeyContext
                        ? <CreditCard className={`w-4 h-4 shrink-0 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                        : <Globe className={`w-4 h-4 shrink-0 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                      }
                      <span className={`font-semibold text-sm ${paymentMethod === 'card' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('billing.paymentCard')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('billing.paymentCardDesc')}</p>
                  </div>
                </label>
              )}

            {region.bankTransferEnabled && (
              <label
                htmlFor="pay-bank"
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/[0.03] shadow-sm' : 'border-transparent bg-muted/40 hover:bg-muted/60'
                }`}
              >
                <RadioGroupItem value="bank_transfer" id="pay-bank" className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className={`w-4 h-4 shrink-0 ${paymentMethod === 'bank_transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-semibold text-sm ${paymentMethod === 'bank_transfer' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('billing.paymentBankTransfer')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('billing.paymentBankTransferDesc')}</p>
                </div>
              </label>
            )}
            </RadioGroup>
          </div>

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

      {/* ── Bank transfer result dialog ───────────────────────────────────────── */}
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
