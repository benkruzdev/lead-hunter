import { MousePointerClick, UserPlus, Download } from "lucide-react";

const steps = [
  {
    icon: MousePointerClick,
    step: "01",
    title: "Arama Yap",
    description: "Şehir ve kategori seçerek işletme araması yapın. Filtreleri kullanarak sonuçları daraltın.",
  },
  {
    icon: UserPlus,
    step: "02",
    title: "Lead'leri Seç",
    description: "İstediğiniz işletmeleri seçip lead listenize ekleyin. Sıcak, ılık veya soğuk olarak etiketleyin.",
  },
  {
    icon: Download,
    step: "03",
    title: "CSV İndir",
    description: "Hazır listenizi CSV olarak indirin ve CRM'inize aktarın. Satışa hemen başlayın!",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Nasıl Çalışır?</h2>
          <p className="text-lg text-muted-foreground">3 basit adımda lead listenizi oluşturun</p>
        </div>
        
        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-24 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative text-center group">
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="w-9 h-9 text-primary-foreground" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center text-sm font-bold text-primary">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
