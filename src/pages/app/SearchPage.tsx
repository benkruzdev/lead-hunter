import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { performSearch, getSearchPage, getSearchSession, SearchResult, getLeadLists, addLeadsToList, LeadList } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Music,
  Youtube,
  Camera,
  Mail,
  Share2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import turkeyData from "@/data/turkey.json";
import { useToast } from "@/hooks/use-toast";
import { SearchIntelligenceBar } from "@/components/app/SearchIntelligenceBar";
import { LeadQualityBadge } from "@/components/app/LeadQualityBadge";
import { ExportTemplateDialog } from "@/components/app/ExportTemplateDialog";
import { templates, mapItemToRecord, generateCSV, downloadCSV } from "@/lib/exportTemplates";
import { getMockSocials } from "@/lib/socials";




// Mock data generator (temporary for PR3 testing - will be replaced with real API)
// Generates 200 results to test pagination modal, confirm/cancel, and same-page-free logic
const generateMockResults = (count: number = 200) => {
  const categories = ["Restoran", "Kafe", "Berber", "KuafÃ¶r", "Market", "Eczane", "Veteriner", "Emlak"];
  const districts = ["KadÄ±kÃ¶y", "BeÅŸiktaÅŸ", "ÅiÅŸli", "Fatih", "ÃœskÃ¼dar", "BeyoÄŸlu", "Ã‡ankaya", "KeÃ§iÃ¶ren"];
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
    address: `${districts[i % districts.length]} Mah. No:${i + 1}, Ä°stanbul`,
    hours: i % 3 === 0 ? "09:00 - 23:00" : "08:00 - 22:00",
  }));
};

const mockResults = generateMockResults(200);

export default function SearchPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Pagination state (PR3)
  const [sessionId, setSessionId] = useState<string | null>(null); // PR4: Backend session tracking
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set([1]));
  const [showPaginationModal, setShowPaginationModal] = useState(false);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // PR4: Error handling

  // List selection dialog state
  const [showListDialog, setShowListDialog] = useState(false);
  const [userLists, setUserLists] = useState<LeadList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [dryRunCost, setDryRunCost] = useState<number | null>(null);
  const [listDialogError, setListDialogError] = useState<string | null>(null);

  const { toast } = useToast();
  const [pendingDistrict, setPendingDistrict] = useState<string | null>(null);

  // Export template dialog state
  const [showExportTemplateDialog, setShowExportTemplateDialog] = useState(false);


  const resultsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));
  // PR4.1: Backend returns 20 results per page, no frontend slicing needed

  // Update available districts when city changes
  useEffect(() => {
    if (city) {
      const selectedProvince = turkeyData.provinces.find((p) => p.name === city);
      const districts = selectedProvince?.districts || [];
      setAvailableDistricts(districts);

      // Apply pending district from preset if available
      if (pendingDistrict && districts.includes(pendingDistrict)) {
        setDistrict(pendingDistrict);
        setPendingDistrict(null);
      } else if (!pendingDistrict) {
        setDistrict(""); // Reset district when city changes manually
      } else {
        // Pending district not in list, clear both
        setPendingDistrict(null);
        setDistrict("");
      }
    } else {
      setAvailableDistricts([]);
      setDistrict("");
      setPendingDistrict(null);
    }
  }, [city, pendingDistrict]);

  // Show onboarding tour for first-time users
  useEffect(() => {
    if (profile && profile.onboarding_completed === false) {
      setShowOnboarding(true);
    }
  }, [profile]);



  // PRODUCT_SPEC 5.4 - Load session from URL param (Continue search)
  useEffect(() => {
    const sid = searchParams.get('sessionId');
    if (sid) {
      loadSession(sid);
    }
  }, [searchParams]);

  const loadSession = async (sid: string) => {
    try {
      const { session } = await getSearchSession(sid);
      setCity(session.province || "");
      setDistrict(session.district || "");
      setCategory(session.category || "");
      setKeyword(session.keyword || "");
      setMinRating([session.min_rating || 0]);
      setMinReviews(session.min_reviews ? session.min_reviews.toString() : "");
      setSessionId(sid);
      setViewedPages(new Set(session.viewed_pages));
      setTotalResults(session.total_results);
      setHasSearched(true);

      // PRODUCT_SPEC 5.4: Auto-load page 1 results for resumed session
      const searchResponse = await performSearch({
        province: session.province || "",
        district: session.district || "",
        category: session.category || "",
        keyword: session.keyword || "",
        minRating: session.min_rating || undefined,
        minReviews: session.min_reviews || undefined,
        sessionId: sid
      });

      setResults(searchResponse.results);
      setCurrentPage(1);
    } catch (error: any) {
      console.error('[SearchPage] Session load error:', error);
      if (error.status === 410) {
        navigate('/app/history', { replace: true });
      } else {
        setErrorMessage('Arama oturumu yÃ¼klenemedi.');
      }
    }
  };


  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setErrorMessage(null);
    setCurrentPage(1);
    setViewedPages(new Set([1]));

    try {
      // Call backend API
      const response = await performSearch({
        province: city,
        district: district || undefined,
        category,
        keyword: keyword || undefined,
        minRating: minRating[0] || undefined,
        minReviews: minReviews ? Number(minReviews) : undefined,
      });

      setSessionId(response.sessionId);
      setResults(response.results as any[]); // Backend returns 20 results for page 1
      setTotalResults(response.totalResults);
      setCurrentPage(1);
      setIsSearching(false);
      setHasSearched(true);

      // Refresh profile to get updated credits instantly (don't wait for 30s polling)
      refreshProfile();
      // Invalidate credits query to trigger immediate refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.credits });
    } catch (error) {
      console.error('[SearchPage] Search failed:', error);
      setErrorMessage('Arama baÅŸarÄ±sÄ±z oldu. LÃ¼tfen tekrar deneyin.');
      setIsSearching(false);
    }
  };



  const handleExportConfirm = (templateId: 'basic' | 'salesCrm' | 'outreach') => {
    const template = templates[templateId];
    const selectedItems = results.filter(item => selectedIds.includes(item.id));

    // Map items to records based on template
    const records = selectedItems.map(item => mapItemToRecord(item, template, city));

    // Generate CSV
    const csvContent = generateCSV(records, template.columns);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads_${templateId}_${timestamp}.csv`;

    // Trigger download
    downloadCSV(csvContent, filename);
  };



  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;

    // Page boundary validation (PR4.1)
    if (newPage < 1 || newPage > totalPages) return;

    // Check if page already viewed (free)
    if (viewedPages.has(newPage)) {
      // Already viewed - fetch without modal
      confirmPageChange(newPage, true);
      return;
    }

    // Show modal for unviewed page (10 credits)
    setPendingPage(newPage);
    setShowPaginationModal(true);
  };

  const confirmPageChange = async (pageToFetch?: number, skipModal: boolean = false) => {
    const targetPage = pageToFetch || pendingPage;
    if (targetPage === null || !sessionId) return;

    setErrorMessage(null);

    try {
      // Call backend API (10 credits or 0 if already viewed)
      const response = await getSearchPage(sessionId, targetPage);

      // PR4.1: Backend returns 20 results for the requested page
      // Replace current results with new page results
      setResults(response.results as any[]);
      setViewedPages(prev => new Set([...prev, targetPage]));
      setCurrentPage(targetPage);

      if (!skipModal) {
        setShowPaginationModal(false);
        setPendingPage(null);
      }

      // PR4.1: Use refreshProfile instead of window.reload
      if (response.creditCost > 0) {
        await refreshProfile();
      }
    } catch (error: any) {
      console.error('[SearchPage] Page change failed:', error);

      // Handle 402 Insufficient Credits
      if (error.message?.includes('Yeterli krediniz yok') || error.message?.includes('Insufficient')) {
        setErrorMessage('Yeterli krediniz yok. LÃ¼tfen kredi satÄ±n alÄ±n.');
      } else {
        setErrorMessage('Sayfa yÃ¼klenemedi. LÃ¼tfen tekrar deneyin.');
      }

      if (!skipModal) {
        setShowPaginationModal(false);
        setPendingPage(null);
      }
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // PR4.1: results already contains only current page (20 items)
    if (selectedIds.length === results.length && results.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map((r) => r.id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Message (PR4 Backend Integration) */}
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setErrorMessage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Åehir */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {t('searchPage.city')}
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-onboarding="city-select" id="city-select">
                <SelectValue placeholder={t('searchPage.selectCity')} />
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

          {/* Ä°lÃ§e */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {t('searchPage.district')}
            </Label>
            <Select value={district} onValueChange={setDistrict} disabled={!city}>
              <SelectTrigger data-onboarding="district-select" id="district-select">
                <SelectValue placeholder={t('searchPage.selectDistrict')} />
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
              {t('searchPage.category')}
            </Label>
            <Input
              data-onboarding="category-input"
              id="category-input"
              type="text"
              placeholder={t('searchPage.categoryPlaceholder')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Anahtar Kelime */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {t('searchPage.keyword')}
            </Label>
            <Input
              id="keyword-input"
              type="text"
              placeholder={t('searchPage.keywordPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Min Rating */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              {t('searchPage.minRating')}: {minRating[0].toFixed(1)}
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
              {t('searchPage.minReviews')}
            </Label>
            <Input
              id="min-reviews-input"
              type="number"
              min="0"
              placeholder={t('searchPage.minReviewsPlaceholder')}
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
                  {t('searchPage.searching')}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  {t('searchPage.search')}
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
                {t('searchPage.resultsFound', { count: totalResults })}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('searchPage.pageOf', { page: currentPage, total: totalPages })}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-sm font-medium text-primary">
                  {t('searchPage.selectedCount', { count: selectedIds.length })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-onboarding="add-to-list"
                disabled={selectedIds.length === 0}
                onClick={async () => {
                  setIsLoadingLists(true);
                  setShowListDialog(true);
                  try {
                    const { lists } = await getLeadLists();
                    setUserLists(lists);
                  } catch (error) {
                    console.error('[SearchPage] Failed to load lists:', error);
                    setErrorMessage(t('leadLists.loadListsFailed'));
                  } finally {
                    setIsLoadingLists(false);
                  }
                }}
              >
                <Plus className="w-4 h-4" />
                {t('searchPage.addSelected', { count: selectedIds.length })}
              </Button>
            </div>
          </div>

          {/* Search Intelligence Bar */}
          <div className="px-4 pb-3">
            <SearchIntelligenceBar cost={0} />
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
                    {t('searchPage.businessName')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.tableCategory')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.tableDistrict')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.rating')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.reviews')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.status')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.email')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.socialProfiles')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    {t('searchPage.actions')}
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
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        {(() => {
                          const socialCount = Object.keys(getMockSocials(item)).length;
                          return socialCount > 0 ? (
                            <div className="text-xs text-muted-foreground">
                              {t('searchPage.socialCount', { count: socialCount })}
                            </div>
                          ) : null;
                        })()}
                        <LeadQualityBadge
                          variant={
                            item.reviews >= 1000 ? "engaged"
                              : item.rating >= 4.5 ? "active"
                                : "new"
                          }
                        />
                      </div>
                    </td>
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
                      <Badge
                        variant={item.isOpen ? "default" : "secondary"}
                        className={item.isOpen ? "bg-green-500" : ""}
                      >
                        {item.isOpen ? t('searchPage.open') : t('searchPage.closed')}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {item.id % 2 === 0 ? (
                        <span className="text-sm text-foreground">{t('common.yes')}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('common.no')}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {(() => {
                        const socials = getMockSocials(item);
                        const hasSocials = Object.keys(socials).length > 0;
                        return hasSocials ? (
                          <span className="text-sm text-foreground">{t('common.yes')}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('common.no')}</span>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailItem(item)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t('searchPage.detail')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 p-4 border-t bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                {t('searchPage.previous')}
              </Button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                {t('searchPage.next')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Ä°ÅŸletme Aramaya BaÅŸlayÄ±n</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Åehir ve kategori seÃ§erek TÃ¼rkiye genelindeki iÅŸletmeleri arayÄ±n.
            SonuÃ§lardan lead listenizi oluÅŸturun.
          </p>
        </div>
      )
      }

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
                    {detailItem.isOpen ? t('searchPage.open') : t('searchPage.closed')}
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
                    ({detailItem.reviews.toLocaleString()} {t('searchPage.reviews')})
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
                      <p className="font-medium">Ã‡alÄ±ÅŸma Saatleri</p>
                      <p className="text-muted-foreground">{detailItem.hours}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{t('searchPage.email')}</p>
                      <p className="text-muted-foreground">
                        {detailItem.id % 2 === 0 ? t('common.yes') : t('common.no')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Share2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{t('searchPage.socialProfiles')}</p>
                      <p className="text-muted-foreground">
                        {Object.keys(getMockSocials(detailItem)).length > 0 ? t('common.yes') : t('common.no')}
                      </p>
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
                    Google Haritalar'da AÃ§
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Credit Confirmation Modal (PR3) */}
      <Dialog open={showPaginationModal} onOpenChange={setShowPaginationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sayfa DeÄŸiÅŸtir</DialogTitle>
            <DialogDescription>
              Sayfa {pendingPage} gÃ¶rÃ¼ntÃ¼lemek iÃ§in 10 kredi harcanacak.
              <br />
              Kalan krediniz: {profile?.credits || 0}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaginationModal(false);
                setPendingPage(null);
              }}
            >
              Ä°ptal
            </Button>
            <Button onClick={() => confirmPageChange()}>
              Onayla (10 kredi)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List Selection Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('leadLists.addToListTitle')}</DialogTitle>
            <DialogDescription>
              {t('leadLists.leadsSelected', { count: selectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingLists ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : userLists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">{t('leadLists.noListsYet')}</p>
              </div>
            ) : (
              <Select value={selectedListId} onValueChange={async (listId) => {
                setSelectedListId(listId);
                setDryRunCost(null);
                try {
                  const selectedLeads = results.filter(r => selectedIds.includes(r.id));
                  const dryRunResult = await addLeadsToList(listId, selectedLeads, { dryRun: true });
                  setDryRunCost(dryRunResult.creditCost || 0);
                } catch (error) {
                  console.error('[SearchPage] DryRun failed:', error);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('leadLists.selectList')} />
                </SelectTrigger>
                <SelectContent>
                  {userLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.lead_count} lead)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {dryRunCost !== null && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium">{t('leadLists.costLabel', { cost: dryRunCost })}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dryRunCost === 0 ? t('leadLists.allDuplicates') : t('leadLists.willAddN', { count: dryRunCost })}
                </p>
              </div>
            )}
            {listDialogError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                {listDialogError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowListDialog(false);
              setSelectedListId("");
              setDryRunCost(null);
              setListDialogError(null);
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selectedListId || isAddingToList || dryRunCost === null}
              onClick={async () => {
                setIsAddingToList(true);
                setListDialogError(null);
                try {
                  const selectedLeads = results.filter(r => selectedIds.includes(r.id));
                  const result = await addLeadsToList(selectedListId, selectedLeads);

                  setShowListDialog(false);
                  setSelectedListId("");
                  setDryRunCost(null);
                  setListDialogError(null);
                  setSelectedIds([]);

                  await refreshProfile();

                  setErrorMessage(`${result.addedCount} lead eklendi${result.skippedCount ? `, ${result.skippedCount} zaten listede` : ''}`);
                  setTimeout(() => setErrorMessage(null), 5000);
                } catch (error: any) {
                  console.error('[SearchPage] Add to list failed:', error);
                  if (error.status === 402) {
                    const requiredText = error.required ? ` ${error.required} kredi gerekli,` : '';
                    const availableText = error.available !== undefined ? ` ${error.available} kredi mevcut.` : '';
                    setListDialogError(t('leadLists.insufficientCredits') + requiredText + availableText);
                  } else {
                    setListDialogError(t('leadLists.addFailed'));
                  }
                } finally {
                  setIsAddingToList(false);
                }
              }}
            >
              {isAddingToList ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('leadLists.adding')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('leadLists.addButtonWithCost', { cost: dryRunCost ?? '?' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Export Template Dialog */}
      <ExportTemplateDialog
        open={showExportTemplateDialog}
        onOpenChange={setShowExportTemplateDialog}
        selectedCount={selectedIds.length}
        onConfirm={handleExportConfirm}
      />

      {/* Onboarding Tour */}
      {
        showOnboarding && profile && !profile.onboarding_completed && (
          <OnboardingTour onComplete={handleOnboardingComplete} />
        )
      }
    </div >
  );
}







