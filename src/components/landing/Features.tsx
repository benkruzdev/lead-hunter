import { Search, ListChecks, FileSpreadsheet } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Şehir + Kategori ile Arama",
    description: "81 il ve yüzlerce sektör kategorisi arasından seçim yapın. Lokasyon bazlı hedefleme ile doğru müşterilere ulaşın.",
  },
  {
    icon: ListChecks,
    title: "Lead Listesi Oluşturma",
    description: "Arama sonuçlarından seçtiğiniz işletmeleri listeleyin. Notlar ekleyin, etiketleyin ve organize edin.",
  },
  {
    icon: FileSpreadsheet,
    title: "CSV ile CRM'e Aktarma",
    description: "Lead listelerinizi tek tıkla CSV formatında indirin. HubSpot, Salesforce veya Excel'e kolayca aktarın.",
  },
];

export function Features() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Güçlü Özellikler, Basit Kullanım
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Türkiye genelinde milyonlarca işletme verisine anında erişin
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-2xl p-8 shadow-soft border hover:shadow-card transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <feature.icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
