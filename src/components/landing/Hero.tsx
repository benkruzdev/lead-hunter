import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 hero-gradient opacity-5" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Türkiye'nin #1 Lead Aracı</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              Türkiye'de İşletme Lead Listeleri{" "}
              <span className="text-gradient">1 Dakikada</span>{" "}
              Hazır
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
              Şehir + sektör seçin, işletmeleri bulun, lead listenizi oluşturun ve CSV'ye aktarın. Satış ekibinizi güçlendirin.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login">
                <Button variant="hero" size="xl" className="w-full sm:w-auto">
                  Ücretsiz Dene
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="hero-outline" size="xl" className="w-full sm:w-auto">
                  Planları Gör
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent border-2 border-background flex items-center justify-center text-xs text-primary-foreground font-semibold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">2.500+</span> şirket kullanıyor
              </p>
            </div>
          </div>
          
          {/* Right - Mock Dashboard Preview */}
          <div className="relative animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="relative bg-card rounded-2xl shadow-card border overflow-hidden">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-background rounded-md px-3 py-1.5 text-xs text-muted-foreground">
                    app.leadhunter.com.tr/search
                  </div>
                </div>
              </div>
              
              {/* Mock dashboard content */}
              <div className="p-6 space-y-4">
                {/* Mock search filters */}
                <div className="flex gap-3">
                  <div className="flex-1 h-10 bg-muted rounded-lg flex items-center px-3 text-sm text-muted-foreground">
                    📍 İstanbul
                  </div>
                  <div className="flex-1 h-10 bg-muted rounded-lg flex items-center px-3 text-sm text-muted-foreground">
                    🏪 Restoran
                  </div>
                  <div className="h-10 px-6 bg-primary text-primary-foreground rounded-lg flex items-center text-sm font-medium">
                    Ara
                  </div>
                </div>
                
                {/* Mock results */}
                <div className="space-y-2">
                  {[
                    { name: "Karadeniz Pidecisi", rating: "4.8", reviews: "1.2K" },
                    { name: "Lezzet Sokağı", rating: "4.6", reviews: "890" },
                    { name: "Anadolu Mutfağı", rating: "4.9", reviews: "2.1K" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-primary rounded" />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>⭐ {item.rating}</span>
                        <span>{item.reviews} yorum</span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Açık</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-muted-foreground">127 sonuç bulundu</span>
                  <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                    Seçilenleri Ekle
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 bg-card rounded-xl shadow-card p-3 border animate-pulse-subtle">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-success text-lg">✓</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lead eklendi</p>
                  <p className="text-sm font-semibold">+24 işletme</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
