import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Building2, CheckCircle2, ExternalLink } from 'lucide-react';
import { getCreditPackages, createOrder, getOrders, getBankTransferProvider, type PaymentProvider } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';

type PaymentMethodUI = 'card' | 'bank_transfer';

interface OrderResult {
  orderId: string;
  paymentMethod: 'card' | 'bank_transfer';
  resolvedProvider?: string;
  // card responses — one of these will be set:
  iframeUrl?: string;
  paymentPageUrl?: string;
  redirectUrl?: string;
  sessionUrl?: string;
  // bank_transfer
  amount?: number;
  currency?: string;
  status?: string;
}

export default function BillingPage() {
  const { t, i18n } = useTranslation();

  const [packages, setPackages] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodUI>('card');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // bank_transfer provider info (fetched from public endpoint)
  const [bankTransferInfo, setBankTransferInfo] = useState<PaymentProvider | null>(null);

  // After successful bank_transfer order — show IBAN info
  const [bankTransferResult, setBankTransferResult] = useState<OrderResult | null>(null);
  const [showBankTransferInfo, setShowBankTransferInfo] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoadingPackages(true);
        setPackagesError(null);
        const data = await getCreditPackages();
        setPackages(data.packages || []);
      } catch (error: any) {
        console.error('[BillingPage] Failed to load packages:', error);
        setPackagesError(error.message || 'Failed to load packages');
      } finally {
        setIsLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoadingOrders(true);
        setOrdersError(null);
        const data = await getOrders();
        setOrders(data.orders || []);
      } catch (error: any) {
        console.error('[BillingPage] Failed to load orders:', error);
        setOrdersError(error.message || 'Failed to load orders');
      } finally {
        setIsLoadingOrders(false);
      }
    };
    fetchOrders();
  }, []);

  // Fetch bank_transfer provider to check if enabled and get IBAN info
  useEffect(() => {
    getBankTransferProvider().then(setBankTransferInfo).catch(() => setBankTransferInfo(null));
  }, []);

  const refreshOrders = async () => {
    try {
      const data = await getOrders();
      setOrders(data.orders || []);
    } catch (_) {}
  };

  const handleBuyClick = (pkg: any) => {
    setSelectedPackage(pkg);
    setPaymentMethod('card');
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
        // Show IBAN / bank transfer instructions
        setBankTransferResult(result);
        setShowPaymentDialog(false);
        setShowBankTransferInfo(true);
        await refreshOrders();
        return;
      }

      // Card: provider redirect
      const redirectTarget = result.sessionUrl || result.redirectUrl || result.paymentPageUrl || result.iframeUrl;
      if (redirectTarget) {
        window.location.href = redirectTarget;
        return;
      }

      // Fallback — no redirect URL returned (provider not yet live)
      setShowPaymentDialog(false);
      await refreshOrders();
    } catch (error: any) {
      console.error('[BillingPage] Order creation failed:', error);
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending':   return 'secondary';
      case 'failed':    return 'destructive';
      default:          return 'outline';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Credit Packages Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{t('billing.packages')}</h2>

        {isLoadingPackages && (
          <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        )}

        {packagesError && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{t('billing.loadPackagesFailed')}</div>
        )}

        {!isLoadingPackages && !packagesError && packages.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`relative bg-card rounded-xl border p-6 transition-all duration-300 hover:shadow-card ${
                  index === 1 ? 'border-primary shadow-glow' : ''
                }`}
              >
                {index === 1 && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    {t('billing.popular')}
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2">{pkg.displayName}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">₺{pkg.price}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pkg.credits.toLocaleString()} {t('billing.credits')}
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant={index === 1 ? 'default' : 'outline'}
                  onClick={() => handleBuyClick(pkg)}
                >
                  <CreditCard className="w-4 h-4" />
                  {t('billing.buyNow')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order History Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('billing.orderHistory')}</h3>

        {isLoadingOrders && (
          <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
        )}

        {ordersError && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{t('billing.loadOrdersFailed')}</div>
        )}

        {!isLoadingOrders && !ordersError && orders.length === 0 && (
          <div className="bg-card rounded-xl border p-8 text-center">
            <p className="text-muted-foreground mb-2">{t('billing.noOrders')}</p>
            <p className="text-sm text-muted-foreground">{t('billing.noOrdersDesc')}</p>
          </div>
        )}

        {!isLoadingOrders && !ordersError && orders.length > 0 && (
          <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('billing.packageName')}</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('billing.amount')}</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('billing.credits')}</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('billing.orderDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4">{order.packageName}</td>
                      <td className="p-4">₺{order.amount} {order.currency}</td>
                      <td className="p-4">{order.credits.toLocaleString()}</td>
                      <td className="p-4">
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {t(`billing.orderStatus.${order.status}`)}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDistanceToNow(new Date(order.createdAt), {
                          addSuffix: true,
                          locale: i18n.language === 'tr' ? tr : enUS,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Payment Method Dialog                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ödeme Yöntemi Seç</DialogTitle>
            <DialogDescription>
              {selectedPackage && (
                <>
                  {selectedPackage.displayName} &mdash; {selectedPackage.credits.toLocaleString()} {t('billing.credits')}
                  <br />
                  <span className="font-medium text-foreground">₺{selectedPackage.price}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as PaymentMethodUI)}
            className="space-y-3"
          >
            {/* Card */}
            <label
              htmlFor="card"
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                paymentMethod === 'card'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="card" id="card" className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm">Kredi / Banka Kartı ile Ödeme</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Güvenli ödeme sağlayıcısı üzerinden anında işlenir.
                </p>
              </div>
            </label>

            {/* Bank transfer — only shown when enabled */}
            {bankTransferInfo?.enabled && (
              <label
                htmlFor="bank_transfer"
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="bank_transfer" id="bank_transfer" className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">IBAN / Havale ile Ödeme</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ödeme bildiriminin ardından admin onayıyla krediniz tanımlanır. 1&ndash;2 iş günü sürebilir.
                  </p>
                </div>
              </label>
            )}
          </RadioGroup>

          {orderError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">{orderError}</div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              disabled={isCreatingOrder}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmOrder} disabled={isCreatingOrder}>
              {isCreatingOrder ? t('common.loading') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Bank Transfer Info Dialog (shown after order creation)              */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showBankTransferInfo} onOpenChange={closeBankTransferInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Sipariş Alındı
            </DialogTitle>
            <DialogDescription>
              Havale / EFT ödemenizi aşağıdaki bilgilere göre gerçekleştirin.
              Ödemeniz onaylandıktan sonra krediniz hesabınıza yüklenir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Ödeme Talimatı</p>
              <p>
                Sipariş numaranız: <span className="font-mono font-medium">{bankTransferResult?.orderId}</span>
              </p>
              <p>
                Tutar: <span className="font-medium">
                  {bankTransferResult?.currency === 'TRY' ? '₺' : '$'}
                  {bankTransferResult?.amount}
                </span>
              </p>
              {bankTransferInfo?.bank_name && (
                <p>Banka: <span className="font-medium">{bankTransferInfo.bank_name}</span></p>
              )}
              {bankTransferInfo?.account_holder && (
                <p>Hesap Sahibi: <span className="font-medium">{bankTransferInfo.account_holder}</span></p>
              )}
              {bankTransferInfo?.iban && (
                <p className="font-mono text-sm break-all">IBAN: <span className="font-bold tracking-wide">{bankTransferInfo.iban}</span></p>
              )}
              <p className="text-muted-foreground text-xs mt-2">
                {bankTransferInfo?.payment_note || 'Açıklamaya sipariş numaranızı yazmayı unutmayın.'}
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
              Siparişiniz onay bekliyor durumunda. Havale sonrası admin tarafından onaylandığında krediniz otomatik olarak tanımlanır.
            </div>
          </div>

          <DialogFooter>
            <Button onClick={closeBankTransferInfo}>Tamam, Anladım</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
