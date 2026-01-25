import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

const plans = [
  {
    name: "Starter",
    credits: "1.000",
    price: "299",
    description: "Küçük ekipler ve freelancer'lar için",
    features: [
      "1.000 arama kredisi",
      "Sınırsız lead listesi",
      "CSV dışa aktarma",
      "E-posta desteği",
    ],
    popular: false,
  },
  {
    name: "Pro",
    credits: "10.000",
    price: "999",
    description: "Büyüyen satış ekipleri için",
    features: [
      "10.000 arama kredisi",
      "Sınırsız lead listesi",
      "CSV dışa aktarma",
      "Öncelikli destek",
      "Detay tamamlama",
      "API erişimi",
    ],
    popular: true,
  },
  {
    name: "Agency",
    credits: "50.000",
    price: "2.499",
    description: "Ajanslar ve kurumsal ekipler için",
    features: [
      "50.000 arama kredisi",
      "Sınırsız lead listesi",
      "CSV dışa aktarma",
      "7/24 destek",
      "Detay tamamlama",
      "API erişimi",
      "Özel entegrasyonlar",
      "Hesap yöneticisi",
    ],
    popular: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Basit ve Şeffaf Fiyatlandırma
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              İhtiyacınıza uygun planı seçin. Tüm planlar kredi tabanlıdır, 
              kullandığınız kadar ödeyin.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card rounded-2xl p-8 border transition-all duration-300 hover:shadow-card ${
                  plan.popular ? "border-primary shadow-glow" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                    En Popüler
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">₺{plan.price}</span>
                    <span className="text-muted-foreground">/ ay</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.credits} kredi dahil
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register">
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    className="w-full"
                  >
                    {plan.popular ? "Hemen Başla" : "Seç"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground mt-12">
            Tüm planlar 7 günlük ücretsiz deneme içerir. Kredi kartı gerekmez.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
