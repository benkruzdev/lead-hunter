import { Button } from "@/components/ui/button";
import { FileDown, Calendar, List } from "lucide-react";

const mockExports = [
  {
    id: 1,
    fileName: "istanbul-restoranlar-2024-01-15.csv",
    date: "2024-01-15",
    leadCount: 127,
  },
  {
    id: 2,
    fileName: "ankara-kuaforler-2024-01-12.csv",
    date: "2024-01-12",
    leadCount: 84,
  },
  {
    id: 3,
    fileName: "izmir-dis-klinikleri-2024-01-10.csv",
    date: "2024-01-10",
    leadCount: 56,
  },
  {
    id: 4,
    fileName: "bursa-cafeler-2024-01-08.csv",
    date: "2024-01-08",
    leadCount: 42,
  },
  {
    id: 5,
    fileName: "antalya-oteller-2024-01-05.csv",
    date: "2024-01-05",
    leadCount: 98,
  },
];

export default function ExportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">CSV Exportlar</h2>
        <p className="text-sm text-muted-foreground">
          Daha önce dışa aktardığınız CSV dosyalarını tekrar indirin
        </p>
      </div>

      {/* Exports table */}
      <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Dosya Adı
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Tarih
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Lead Sayısı
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground w-32">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {mockExports.map((exp) => (
                <tr
                  key={exp.id}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileDown className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-medium">{exp.fileName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(exp.date).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <List className="w-4 h-4" />
                      {exp.leadCount} lead
                    </div>
                  </td>
                  <td className="p-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => alert("Dosya indirildi!")}
                    >
                      <FileDown className="w-4 h-4" />
                      İndir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {mockExports.length === 0 && (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <FileDown className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Henüz Export Yok</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Lead listelerinizden CSV dışa aktardığınızda burada görünecektir.
          </p>
        </div>
      )}
    </div>
  );
}
