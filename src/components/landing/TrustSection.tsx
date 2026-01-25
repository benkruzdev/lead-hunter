import { Building2, Users, Briefcase } from "lucide-react";

export function TrustSection() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ajanslar, Satış Ekipleri ve Freelancer'lar için
          </h2>
          <p className="text-muted-foreground">
            Türkiye'nin önde gelen şirketleri tarafından tercih ediliyor
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {[
            { name: "Dijital Ajans Co.", icon: Building2 },
            { name: "SatışPro", icon: Users },
            { name: "B2B Solutions", icon: Briefcase },
            { name: "Growth Agency", icon: Building2 },
            { name: "LeadGen TR", icon: Users },
          ].map((company, index) => (
            <div
              key={index}
              className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <company.icon className="w-6 h-6" />
              <span className="font-medium">{company.name}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50K+", label: "Aktif Lead" },
            { value: "2.5K+", label: "Kullanıcı" },
            { value: "81", label: "İl Kapsama" },
            { value: "99.9%", label: "Uptime" },
          ].map((stat, index) => (
            <div key={index}>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
