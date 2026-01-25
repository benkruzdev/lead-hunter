import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, ArrowRight, Zap, Star, Building2 } from "lucide-react";

const plans = [
  {
    name: "Starter",
    credits: "1.000",
    price: "299",
    icon: Zap,
    description: "Küçük ekipler için",
    features: ["1.000 arama kredisi", "Sınırsız liste", "CSV export", "E-posta desteği"],
    current: false,
  },
  {
    name: "Pro",
    credits: "10.000",
    price: "999",
    icon: Star,
    description: "Büyüyen ekipler için",
    features: ["10.000 arama kredisi", "Sınırsız liste", "CSV export", "Öncelikli destek", "API erişimi"],
    current: true,
  },
  {
    name: "Agency",
    credits: "50.000",
    price: "2.499",
    icon: Building2,
    description: "Ajanslar için",
    features: ["50.000 arama kredisi", "Sınırsız liste", "CSV export", "7/24 destek", "Özel entegrasyonlar"],
    current: false,
  },
];

const creditHistory = [
  { date: "2024-01-15", description: "Lead listesine eklendi (İstanbul Restoranlar)", amount: -45 },
  { date: "2024-01-14", description: "CSV Export", amount: 0 },
  { date: "2024-01-12", description: "Detay tamamlama", amount: -120 },
  { date: "2024-01-10", description: "Lead listesine eklendi (Ankara Kuaförler)", amount: -84 },
  { date: "2024-01-01", description: "Pro plan yenilendi", amount: 10000 },
];

export default function BillingPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Current plan summary */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Mevcut Plan: Pro</h2>
            <p className="text-muted-foreground">
              Bir sonraki yenileme: 1 Şubat 2024
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Kalan Kredi</p>
              <p className="text-3xl font-bold text-primary">1.250</p>
            </div>
            <Button>
              <CreditCard className="w-4 h-4" />
              Kredi Satın Al
            </Button>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Plan Seçenekleri</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-xl border p-6 transition-all duration-300 hover:shadow-card ${
                plan.current ? "border-primary shadow-glow" : ""
              }`}
            >
              {plan.current && (
                <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Mevcut Plan
                </div>
              )}

              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <plan.icon className="w-6 h-6 text-primary" />
              </div>

              <h4 className="text-xl font-bold mb-1">{plan.name}</h4>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

              <div className="mb-4">
                <span className="text-3xl font-bold">₺{plan.price}</span>
                <span className="text-muted-foreground"> / ay</span>
                <p className="text-sm text-muted-foreground">{plan.credits} kredi dahil</p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.current ? "outline" : "default"}
                className="w-full"
                disabled={plan.current}
              >
                {plan.current ? "Mevcut Plan" : "Satın Al"}
                {!plan.current && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Credit history */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Kredi Hareketleri</h3>
        <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Tarih
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Açıklama
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                    Kredi
                  </th>
                </tr>
              </thead>
              <tbody>
                {creditHistory.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 text-muted-foreground">
                      {new Date(item.date).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="p-4">{item.description}</td>
                    <td className={`p-4 text-right font-medium ${
                      item.amount > 0 ? "text-success" : item.amount < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {item.amount > 0 ? "+" : ""}{item.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
