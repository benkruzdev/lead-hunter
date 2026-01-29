import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { CreditCard, Check } from 'lucide-react';
import { getCreditPackages, createOrder, getOrders } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Fetch packages
  const { data: packagesData, isLoading: isLoadingPackages, error: packagesError } = useQuery(
    ['creditPackages'],
    getCreditPackages
  );

  // Fetch orders
  const { data: ordersData, isLoading: isLoadingOrders, error: ordersError } = useQuery(
    ['orders'],
    getOrders
  );

  const handleBuyClick = (pkg: any) => {
    setSelectedPackage(pkg);
    setShowPaymentDialog(true);
    setOrderError(null);
  };

  const handleConfirmOrder = async () => {
    if (!selectedPackage) return;

    try {
      setIsCreatingOrder(true);
      setOrderError(null);

      await createOrder(selectedPackage.id, paymentMethod);

      // Refresh orders
      queryClient.invalidateQueries(['orders']);

      // Close dialog and show success
      setShowPaymentDialog(false);
      setSelectedPackage(null);
      setPaymentMethod('manual');

      // Show success message (you could use a toast here)
      alert(t('billing.orderCreated') + ': ' + t('billing.orderCreatedDesc'));
    } catch (error: any) {
      console.error('[BillingPage] Order creation failed:', error);
      setOrderError(error.message || t('billing.orderFailed'));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Credit Packages Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{t('billing.packages')}</h2>

        {isLoadingPackages && (
          <div className="text-center py-12 text-muted-foreground">
            {t('common.loading')}
          </div>
        )}

        {packagesError && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {t('billing.loadPackagesFailed')}
          </div>
        )}

        {packagesData && (
          <div className="grid md:grid-cols-3 gap-6">
            {packagesData.packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`relative bg-card rounded-xl border p-6 transition-all duration-300 hover:shadow-card ${index === 1 ? 'border-primary shadow-glow' : ''
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
          <div className="text-center py-8 text-muted-foreground">
            {t('common.loading')}
          </div>
        )}

        {ordersError && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {t('billing.loadOrdersFailed')}
          </div>
        )}

        {ordersData && ordersData.orders.length === 0 && (
          <div className="bg-card rounded-xl border p-8 text-center">
            <p className="text-muted-foreground mb-2">{t('billing.noOrders')}</p>
            <p className="text-sm text-muted-foreground">
              {t('billing.noOrdersDesc')}
            </p>
          </div>
        )}

        {ordersData && ordersData.orders.length > 0 && (
          <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      {t('billing.packageName')}
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      {t('billing.amount')}
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      {t('billing.credits')}
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      {t('common.status')}
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      {t('billing.orderDate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordersData.orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4">{order.packageName}</td>
                      <td className="p-4">
                        ₺{order.amount} {order.currency}
                      </td>
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

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing.selectPaymentMethod')}</DialogTitle>
            <DialogDescription>
              {selectedPackage && (
                <>
                  {selectedPackage.displayName} - {selectedPackage.credits.toLocaleString()}{' '}
                  {t('billing.credits')}
                  <br />
                  {t('billing.costTransparency', {
                    amount: selectedPackage.price,
                    currency: selectedPackage.currency,
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual" className="flex-1 cursor-pointer">
                {t('billing.paymentMethods.manual')}
              </Label>
            </div>

            <div className="flex items-center space-x-2 opacity-50">
              <RadioGroupItem value="paytr" id="paytr" disabled />
              <Label htmlFor="paytr" className="flex-1">
                {t('billing.paymentMethods.paytr')}
                <Badge variant="secondary" className="ml-2">
                  {t('billing.comingSoon')}
                </Badge>
              </Label>
            </div>

            <div className="flex items-center space-x-2 opacity-50">
              <RadioGroupItem value="iyzico" id="iyzico" disabled />
              <Label htmlFor="iyzico" className="flex-1">
                {t('billing.paymentMethods.iyzico')}
                <Badge variant="secondary" className="ml-2">
                  {t('billing.comingSoon')}
                </Badge>
              </Label>
            </div>

            <div className="flex items-center space-x-2 opacity-50">
              <RadioGroupItem value="shopier" id="shopier" disabled />
              <Label htmlFor="shopier" className="flex-1">
                {t('billing.paymentMethods.shopier')}
                <Badge variant="secondary" className="ml-2">
                  {t('billing.comingSoon')}
                </Badge>
              </Label>
            </div>
          </RadioGroup>

          {orderError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {orderError}
            </div>
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
    </div>
  );
}
