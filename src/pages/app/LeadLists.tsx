import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, List, Calendar, ArrowRight } from "lucide-react";

const mockLists = [
  {
    id: "1",
    name: "İstanbul Restoranlar",
    leadCount: 127,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Ankara Kuaförler",
    leadCount: 84,
    createdAt: "2024-01-12",
  },
  {
    id: "3",
    name: "İzmir Diş Klinikleri",
    leadCount: 56,
    createdAt: "2024-01-10",
  },
  {
    id: "4",
    name: "Bursa Cafe'ler",
    leadCount: 42,
    createdAt: "2024-01-08",
  },
];

export default function LeadLists() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Lead Listelerim</h2>
          <p className="text-sm text-muted-foreground">
            Oluşturduğunuz lead listelerini yönetin
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Yeni Liste Oluştur
        </Button>
      </div>

      {/* Lists grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockLists.map((list) => (
          <div
            key={list.id}
            className="group bg-card rounded-xl border shadow-soft p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <List className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">{list.name}</h3>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{list.leadCount}</span>
                lead
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(list.createdAt).toLocaleDateString("tr-TR")}
              </span>
            </div>

            <Link to={`/app/lists/${list.id}`}>
              <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                Aç
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        ))}
      </div>

      {mockLists.length === 0 && (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <List className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Henüz Liste Yok</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            İlk lead listenizi oluşturmak için arama yapın ve işletmeleri ekleyin.
          </p>
          <Link to="/app/search">
            <Button>Arama Yap</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
