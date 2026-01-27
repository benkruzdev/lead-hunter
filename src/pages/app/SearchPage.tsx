import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  MapPin,
  Tag,
  Star,
  MessageSquare,
  Eye,
  Plus,
  X,
  Phone,
  Globe,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import turkeyData from "@/data/turkey.json";

// Mock data generator (temporary for PR3 testing - will be replaced with real API)
// Generates 200 results to test pagination modal, confirm/cancel, and same-page-free logic
const generateMockResults = (count: number = 200) => {
  const categories = ["Restoran", "Kafe", "Berber", "Kuaför", "Market", "Eczane", "Veteriner", "Emlak"];
  const districts = ["Kadıköy", "Beşiktaş", "Şişli", "Fatih", "Üsküdar", "Beyoğlu", "Çankaya", "Keçiören"];
  const adjectives = ["Modern", "Lezzet", "Tarihi", "Yeni", "Anadolu", "Karadeniz", "Ege", "Akdeniz"];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${adjectives[i % adjectives.length]} ${categories[i % categories.length]} ${Math.floor(i / 10) + 1}`,
    category: categories[i % categories.length],
    district: districts[i % districts.length],
    rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
    reviews: Math.floor(Math.random() * 3000) + 100,
    isOpen: i % 3 !== 0,
    phone: `+90 ${210 + (i % 6)}${(i % 10).toString().padStart(2, '0')} 555 ${String(1000 + i).slice(-4)}`,
    website: `www.business${i + 1}.com`,
    address: `${districts[i % districts.length]} Mah. No:${i + 1}, İstanbul`,
    hours: i % 3 === 0 ? "09:00 - 23:00" : "08:00 - 22:00",
  }));
};

const mockResults = generateMockResults(200);

export default function SearchPage() {
  const { profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minRating, setMinRating] = useState([0]);
  const [minReviews, setMinReviews] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<typeof mockResults>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailItem, setDetailItem] = useState<(typeof mockResults)[0] | null>(null);

  // Update available districts when city changes
  useEffect(() => {
    if (city) {
      const selectedProvince = turkeyData.provinces.find((p) => p.name === city);
      setAvailableDistricts(selectedProvince?.districts || []);
      setDistrict(""); // Reset district when city changes
    } else {
      setAvailableDistricts([]);
      setDistrict("");
    }
  }, [city]);

  // Show onboarding tour for first-time users
  useEffect(() => {
    if (profile && profile.onboarding_completed === false) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleSearch = () => {
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setResults(mockResults);
      setIsSearching(false);
      setHasSearched(true);
    }, 1500);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === results.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map((r) => r.id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filter Panel */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Şehir */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Şehir
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-onboarding="city-select" id="city-select">
                <SelectValue placeholder="Şehir seçin" />
              </SelectTrigger>
              <SelectContent>
                {turkeyData.provinces.map((province) => (
                  <SelectItem key={province.id} value={province.name}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* İlçe */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              İlçe
            </Label>
            <Select value={district} onValueChange={setDistrict} disabled={!city}>
              <SelectTrigger data-onboarding="district-select" id="district-select">
                <SelectValue placeholder={city ? "İlçe seçin" : "Önce şehir seçin"} />
              </SelectTrigger>
              <SelectContent>
                {availableDistricts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kategori (Free text input per PRODUCT_SPEC) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Kategori
            </Label>
            <Input
              data-onboarding="category-input"
              id="category-input"
              type="text"
              placeholder="ör. Restoran, Kafe, Berber"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Anahtar Kelime */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Anahtar Kelime
            </Label>
            <Input
              id="keyword-input"
              type="text"
              placeholder="Örn: vegan, 24 saat, paket servis"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Min Rating */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              Min. Puan: {minRating[0].toFixed(1)}
            </Label>
            <Slider
              id="min-rating-slider"
              value={minRating}
              onValueChange={setMinRating}
              min={0}
              max={5}
              step={0.1}
              className="py-2"
            />
          </div>

          {/* Min Reviews */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Min. Yorum
            </Label>
            <Input
              id="min-reviews-input"
              type="number"
              min="0"
              placeholder="En az yorum sayısı"
              value={minReviews}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMinReviews(value < 0 ? "0" : e.target.value);
              }}
            />
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <Button
              data-onboarding="search-button"
              onClick={handleSearch}
              className="w-full"
              disabled={!city || !category || isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aranıyor...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Ara
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isSearching ? (
        <div className="bg-card rounded-xl border shadow-soft p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg skeleton-loading">
                <div className="w-5 h-5 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-6 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : hasSearched ? (
        <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
          {/* Results header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {results.length} sonuç bulundu
              </span>
              {selectedIds.length > 0 && (
                <span className="text-sm font-medium text-primary">
                  {selectedIds.length} seçili
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Kalan: 1.250 kredi
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Her lead ekleme 1 kredi harcar
                </TooltipContent>
              </Tooltip>
              <Button
                data-onboarding="add-to-list"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  alert(`${selectedIds.length} lead listenize eklendi!`);
                  setSelectedIds([]);
                }}
              >
                <Plus className="w-4 h-4" />
                Seçilenleri Ekle ({selectedIds.length})
              </Button>
              <Button
                data-onboarding="export-csv"
                variant="outline"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  alert(`${selectedIds.length} lead CSV olarak indiriliyor...`);
                }}
              >
                <FileDown className="w-4 h-4" />
                CSV İndir ({selectedIds.length})
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-4 w-12">
                    <Checkbox
                      checked={selectedIds.length === results.length && results.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    İşletme Adı
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Kategori
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    İlçe
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Puan
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Yorum
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Durum
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-4 font-medium">{item.name}</td>
                    <td className="p-4 text-muted-foreground">{item.category}</td>
                    <td className="p-4 text-muted-foreground">{item.district}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        {item.rating}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{item.reviews.toLocaleString()}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.isOpen ? "chip-open" : "chip-closed"
                          }`}
                      >
                        {item.isOpen ? "Açık" : "Kapalı"}
                      </span>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailItem(item)}
                      >
                        <Eye className="w-4 h-4" />
                        Detay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">İşletme Aramaya Başlayın</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Şehir ve kategori seçerek Türkiye genelindeki işletmeleri arayın.
            Sonuçlardan lead listenizi oluşturun.
          </p>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <SheetContent className="sm:max-w-lg">
          {detailItem && (
            <div className="animate-slide-in-right">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl">{detailItem.name}</SheetTitle>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {detailItem.category}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${detailItem.isOpen ? "chip-open" : "chip-closed"
                      }`}
                  >
                    {detailItem.isOpen ? "Açık" : "Kapalı"}
                  </span>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="text-lg font-semibold">{detailItem.rating}</span>
                  </div>
                  <span className="text-muted-foreground">
                    ({detailItem.reviews.toLocaleString()} yorum)
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Adres</p>
                      <p className="text-muted-foreground">{detailItem.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Telefon</p>
                      <p className="text-muted-foreground">{detailItem.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Website</p>
                      <p className="text-primary">{detailItem.website}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Çalışma Saatleri</p>
                      <p className="text-muted-foreground">{detailItem.hours}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <Button className="w-full" onClick={() => {
                    alert("Lead listenize eklendi!");
                    setDetailItem(null);
                  }}>
                    <Plus className="w-4 h-4" />
                    Lead Listeme Ekle
                  </Button>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4" />
                    Google Haritalar'da Aç
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Onboarding Tour */}
      {showOnboarding && profile && !profile.onboarding_completed && (
        <OnboardingTour onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}
