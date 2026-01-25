import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  FileDown,
  Sparkles,
  Trash2,
  Pencil,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const mockLeads = [
  {
    id: 1,
    name: "Karadeniz Pidecisi",
    phone: "+90 216 555 1234",
    website: "www.karadenizpide.com",
    tag: "hot",
    note: "İlgili görüşme yapıldı",
  },
  {
    id: 2,
    name: "Lezzet Sokağı",
    phone: "+90 212 555 5678",
    website: "www.lezzetsokagi.com.tr",
    tag: "warm",
    note: "",
  },
  {
    id: 3,
    name: "Anadolu Mutfağı",
    phone: "+90 216 555 9012",
    website: "www.anadolumutfagi.com",
    tag: "cold",
    note: "Sonra tekrar dene",
  },
  {
    id: 4,
    name: "Beyoğlu Meyhanesi",
    phone: "+90 212 555 3456",
    website: "www.beyoglumeyhanesi.com",
    tag: "hot",
    note: "Demo planlandı",
  },
  {
    id: 5,
    name: "Tarihi Sultanahmet Köftecisi",
    phone: "+90 212 555 7890",
    website: "www.sultanahmetkoftecisi.com",
    tag: "warm",
    note: "",
  },
];

const tagLabels: Record<string, string> = {
  hot: "Sıcak",
  warm: "Ilık",
  cold: "Soğuk",
};

const tagClasses: Record<string, string> = {
  hot: "chip-hot",
  warm: "chip-warm",
  cold: "chip-cold",
};

export default function ListDetail() {
  const { id } = useParams();
  const [listName, setListName] = useState("İstanbul Restoranlar");
  const [isEditingName, setIsEditingName] = useState(false);
  const [leads, setLeads] = useState(mockLeads);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [showCompleteWarning, setShowCompleteWarning] = useState(false);

  const updateTag = (leadId: number, tag: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, tag } : l))
    );
  };

  const updateNote = (leadId: number, note: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, note } : l))
    );
  };

  const deleteLead = (leadId: number) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          to="/app/lists"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="text-xl font-semibold h-auto py-1 px-2"
                />
                <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{listName}</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditingName(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowCompleteWarning(true)}>
              <Sparkles className="w-4 h-4" />
              Detayları Tamamla
            </Button>
            <Button onClick={() => setShowExportWarning(true)}>
              <FileDown className="w-4 h-4" />
              CSV Dışa Aktar
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {leads.length} lead · Oluşturulma: 15 Ocak 2024
        </p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  İşletme Adı
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Telefon
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Website
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground w-32">
                  Etiket
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                  Not
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground w-16">
                  Sil
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4 font-medium">{lead.name}</td>
                  <td className="p-4 text-muted-foreground">{lead.phone}</td>
                  <td className="p-4">
                    <a
                      href={`https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {lead.website}
                    </a>
                  </td>
                  <td className="p-4">
                    <Select
                      value={lead.tag}
                      onValueChange={(val) => updateTag(lead.id, val)}
                    >
                      <SelectTrigger className={`w-28 h-8 text-xs ${tagClasses[lead.tag]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot">🔥 Sıcak</SelectItem>
                        <SelectItem value="warm">🌤️ Ilık</SelectItem>
                        <SelectItem value="cold">❄️ Soğuk</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-4">
                    <Input
                      placeholder="Not ekle..."
                      value={lead.note}
                      onChange={(e) => updateNote(lead.id, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="p-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLead(lead.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export confirmation dialog */}
      <Dialog open={showExportWarning} onOpenChange={setShowExportWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV Dışa Aktar</DialogTitle>
            <DialogDescription>
              {leads.length} lead CSV dosyası olarak indirilecek. Bu işlem kredi harcamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportWarning(false)}>
              İptal
            </Button>
            <Button onClick={() => {
              setShowExportWarning(false);
              alert("CSV dosyası indirildi!");
            }}>
              <FileDown className="w-4 h-4" />
              İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete details warning dialog */}
      <Dialog open={showCompleteWarning} onOpenChange={setShowCompleteWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Detayları Tamamla
            </DialogTitle>
            <DialogDescription>
              Bu işlem lead'lerin eksik bilgilerini (e-posta, sosyal medya vb.) tamamlayacak.
              <br /><br />
              <span className="font-semibold text-foreground">
                Maliyet: {leads.length * 2} kredi ({leads.length} lead × 2 kredi)
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteWarning(false)}>
              İptal
            </Button>
            <Button onClick={() => {
              setShowCompleteWarning(false);
              alert("Detaylar tamamlandı!");
            }}>
              <Sparkles className="w-4 h-4" />
              Devam Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
