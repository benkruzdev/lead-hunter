import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { performSearch, getSearchPage, getSearchSession, getSearchCreditCost, SearchResult, getLeadLists, addLeadsToList, createLeadList, LeadList } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useTranslation } from "react-i18next";
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
  ExternalLink,
  Loader2,
  AlertCircle,
  Mail,
  Copy,
  Navigation,
  Zap,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ExportTemplateDialog } from "@/components/app/ExportTemplateDialog";
import { templates, mapItemToRecord, generateCSV, downloadCSV } from "@/lib/exportTemplates";

// ─── Contact status helper ─────────────────────────────────────────────────
// ── İletişim: mevcut veriyi yansıtır (phone / website) ────────────────────
type ContactStatusKey = "phoneAndWebsite" | "hasPhone" | "hasWebsite" | "noContactData";

function getContactStatus(item: SearchResult): ContactStatusKey {
  if (item.phone && item.website) return "phoneAndWebsite";
  if (item.phone) return "hasPhone";
  if (item.website) return "hasWebsite";
  return "noContactData";
}

const contactStatusConfig: Record<ContactStatusKey, { label: string; className: string }> = {
  phoneAndWebsite: { label: "Telefon + Website", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  hasPhone:        { label: "Telefon Var",        className: "bg-blue-50 text-blue-700 border-blue-200" },
  hasWebsite:      { label: "Website Var",         className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  noContactData:   { label: "İletişim Verisi Yok", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

// ── Ek İletişim: e-posta/sosyal zenginleştirme potansiyelini yansıtır ──────
// Website varlığı = dış veri kaynağı mevcut = zenginleştirme mümkün
type EnrichmentPotentialKey = "canEnrich" | "noEnrichmentSource";

function getEnrichmentPotential(item: SearchResult): EnrichmentPotentialKey {
  return item.website ? "canEnrich" : "noEnrichmentSource";
}

const enrichmentPotentialConfig: Record<EnrichmentPotentialKey, { label: string; className: string }> = {
  canEnrich:           { label: "Zenginleştirme Mümkün", className: "bg-violet-50 text-violet-700 border-violet-200" },
  noEnrichmentSource:  { label: "Ek Veri Kaynağı Yok",   className: "bg-gray-100 text-gray-400 border-gray-200" },
};

// ── Lead Potansiyeli: deterministik 0-100 skor ────────────────────────────
// A) Yorum hacmi: max 45
function reviewScore(reviews: number | null | undefined): number {
  const r = reviews ?? 0;
  if (r >= 1000) return 45;
  if (r >= 250)  return 40;
  if (r >= 100)  return 30;
  if (r >= 25)   return 18;
  if (r >= 1)    return 8;
  return 0;
}
// B) Puan: max 30
function ratingScore(rating: number | null | undefined): number {
  const v = rating ?? 0;
  if (v >= 4.6) return 30;
  if (v >= 4.3) return 24;
  if (v >= 4.0) return 18;
  if (v >= 3.5) return 10;
  return 0;
}
// C) Website: max 15  D) Telefon: max 10
function computeLeadScore(item: SearchResult): number {
  return (
    reviewScore(item.reviews) +
    ratingScore(item.rating) +
    (item.website ? 15 : 0) +
    (item.phone   ? 10 : 0)
  );
}

type LeadLevelKey = "high" | "mid" | "low";
function getLeadLevel(score: number): LeadLevelKey {
  if (score >= 80) return "high";
  if (score >= 55) return "mid";
  return "low";
}
const leadLevelConfig: Record<LeadLevelKey, { label: string; className: string }> = {
  high: { label: "Yüksek", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  mid:  { label: "Orta",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  low:  { label: "Düşük",  className: "bg-gray-100 text-gray-500 border-gray-200" },
};



// ── Location formatter (global-ready) ─────────────────────────────────────────
// district = subregion (e.g. Kadıköy), city = region/province (e.g. İstanbul)
// Output: "İlçe, Şehir" | "Şehir" | "—"
function formatLocation(district: string | null | undefined, city: string | null | undefined): string {
  const d = district?.trim();
  const c = city?.trim();
  if (d && c) return `${d}, ${c}`;
  if (d)      return d;
  if (c)      return c;
  return "—";
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Location state (global-ready naming) ──
  // country: currently always Türkiye (locked), region = city, subregion = district
  const [country] = useState("Türkiye");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  // ── Search filters ──
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minRating, setMinRating] = useState([0]);
  const [minReviews, setMinReviews] = useState("");

  // ── UI state ──
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<SearchResult | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // ── Pagination / load-more state ──
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState(2);       // next page to load-more
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);     // whether more pages exist
  const [isLoadingMore, setIsLoadingMore] = useState(false); // separate from main isSearching
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Credit cost info (used in load-more button label)
  const [creditsPerPage, setCreditsPerPage]             = useState(10);
  const [creditsPerEnrichment, setCreditsPerEnrichment] = useState(1);

  // Request-sequence guards:
  // reqSeq    — search & session restore (full result replacement)
  // loadMoreSeq — load-more only (append path, separate counter)
  const reqSeq = useRef(0);
  const loadMoreSeq = useRef(0);

  const resultsPerPage = 20;
  const [showListDialog, setShowListDialog] = useState(false);
  const [userLists, setUserLists] = useState<LeadList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [dryRunCost, setDryRunCost] = useState<number | null>(null);
  const [listDialogError, setListDialogError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);

  const { toast } = useToast();
  const [pendingDistrict, setPendingDistrict] = useState<string | null>(null);

  // ── Export template dialog state ──
  const [showExportTemplateDialog, setShowExportTemplateDialog] = useState(false);

  // ── Ref for auto-scroll to results ──
  const resultsRef = useRef<HTMLDivElement>(null);


  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (city) {
      const selectedProvince = turkeyData.provinces.find((p) => p.name === city);
      const districts = selectedProvince?.districts || [];
      setAvailableDistricts(districts);
      if (pendingDistrict && districts.includes(pendingDistrict)) {
        setDistrict(pendingDistrict);
        setPendingDistrict(null);
      } else if (!pendingDistrict) {
        setDistrict("");
      } else {
        setPendingDistrict(null);
        setDistrict("");
      }
    } else {
      setAvailableDistricts([]);
      setDistrict("");
      setPendingDistrict(null);
    }
  }, [city, pendingDistrict]);

  useEffect(() => {
    if (profile && profile.onboarding_completed === false) {
      setShowOnboarding(true);
    }
  }, [profile]);

  useEffect(() => {
    const sid = searchParams.get("sessionId");
    if (sid) {
      loadSession(sid);
    } else {
      // sessionId removed from URL: clear session-restore state to avoid
      // stale results/pagination from a previous restored session being shown.
      // Form fields (city/district/category/keyword/filters) are intentionally
      // left intact so the user can still launch a fresh search.
      setSessionId(null);
      setResults([]);
      setTotalResults(0);
      setHasMore(false);
      setNextPage(2);
      setHasSearched(false);
      setErrorMessage(null);
    }
  }, [searchParams]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const loadSession = useCallback(async (sid: string) => {
    const seq = ++reqSeq.current;
    console.debug('[DEBUG][SearchPage] loadSession:start', { sid, seq });
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const { session } = await getSearchSession(sid);
      if (seq !== reqSeq.current) {
        console.debug('[DEBUG][SearchPage] loadSession:stale — discarding', { seq, current: reqSeq.current });
        return;
      }

      setCity(session.province || "");
      setPendingDistrict(session.district || null);
      setCategory(session.category || "");
      setKeyword(session.keyword || "");
      setMinRating([session.min_rating || 0]);
      setMinReviews(session.min_reviews ? session.min_reviews.toString() : "");
      setSessionId(sid);
      setTotalResults(session.total_results);
      setHasSearched(true);
      setSelectedIds([]);   // clear selections on session restore

      getSearchCreditCost().then(costs => {
        setCreditsPerPage(costs.credits_per_page);
        setCreditsPerEnrichment(costs.credits_per_enrichment);
      }).catch(() => { /* keep defaults */ });

      const searchResponse = await performSearch({
        province: session.province || "",
        district: session.district || "",
        category: session.category || "",
        keyword: session.keyword || "",
        minRating: session.min_rating || undefined,
        minReviews: session.min_reviews || undefined,
        sessionId: sid,
      });

      if (seq !== reqSeq.current) {
        console.debug('[DEBUG][SearchPage] loadSession:stale after performSearch — discarding', { seq, current: reqSeq.current });
        return;
      }
      setResults(searchResponse.results);
      const total = searchResponse.totalResults ?? session.total_results;
      setTotalResults(total);
      setNextPage(2);
      setHasMore(searchResponse.results.length < total);
      console.debug('[DEBUG][SearchPage] loadSession:success', { sid, results: searchResponse.results.length, total });
    } catch (error: any) {
      if (seq !== reqSeq.current) {
        console.debug('[DEBUG][SearchPage] loadSession:catch stale — discarding', { seq });
        return;
      }
      console.error('[DEBUG][SearchPage] loadSession:catch', { sid, status: error?.status, message: error?.message });
      if (error.status === 410) {
        navigate("/app/history", { replace: true });
      } else {
        setErrorMessage(t("searchPage.sessionLoadFailed"));
      }
    } finally {
      const willClear = seq === reqSeq.current;
      console.debug('[DEBUG][SearchPage] loadSession:finally', { seq, willClearSpinner: willClear });
      if (willClear) setIsSearching(false);
    }
  }, [navigate, t]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleSearch = async () => {
    const seq = ++reqSeq.current;
    console.debug('[DEBUG][SearchPage] handleSearch:start', { seq, city, category });
    setIsSearching(true);
    setErrorMessage(null);
    setSelectedIds([]);     // clear selection on new search

    try {
      const response = await performSearch({
        province: city,
        district: district || undefined,
        category,
        keyword: keyword || undefined,
        minRating: minRating[0] || undefined,
        minReviews: minReviews ? Number(minReviews) : undefined,
      });

      if (seq !== reqSeq.current) {
        console.debug('[DEBUG][SearchPage] handleSearch:stale — discarding', { seq, current: reqSeq.current });
        return;
      }
      setSessionId(response.sessionId);
      setResults(response.results as any[]);
      setTotalResults(response.totalResults);
      setNextPage(2);
      setHasMore((response.results as any[]).length < response.totalResults);
      setHasSearched(true);
      console.debug('[DEBUG][SearchPage] handleSearch:success', { seq, results: (response.results as any[]).length, total: response.totalResults, sessionId: response.sessionId });

      getSearchCreditCost().then(costs => {
        setCreditsPerPage(costs.credits_per_page);
        setCreditsPerEnrichment(costs.credits_per_enrichment);
      }).catch(() => { /* keep defaults */ });

      refreshProfile();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.credits });
    } catch (error: any) {
      if (seq !== reqSeq.current) {
        console.debug('[DEBUG][SearchPage] handleSearch:catch stale — discarding', { seq });
        return;
      }
      console.error('[DEBUG][SearchPage] handleSearch:catch', { seq, status: error?.status, message: error?.message });
      setErrorMessage(t("searchPage.searchFailed"));
    } finally {
      const willClear = seq === reqSeq.current;
      console.debug('[DEBUG][SearchPage] handleSearch:finally', { seq, willClearSpinner: willClear });
      if (willClear) setIsSearching(false);
    }
  };

  const handleExportConfirm = (templateId: "basic" | "salesCrm" | "outreach") => {
    const template = templates[templateId];
    const selectedItems = results.filter(item => selectedIds.includes(item.id));
    const records = selectedItems.map(item => mapItemToRecord(item, template, city));
    const csvContent = generateCSV(records, template.columns);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `leads_${templateId}_${timestamp}.csv`;
    downloadCSV(csvContent, filename);
  };


  // ── Load More ──
  const handleLoadMore = () => {
    console.debug('[DEBUG][SearchPage] handleLoadMore:clicked', {
      sessionId,
      isLoadingMore,
      detailOpen: !!detailItem,
      detailId: detailItem?.id ?? null,
      nextPage,
    });
    if (!sessionId || isLoadingMore) {
      console.debug('[DEBUG][SearchPage] handleLoadMore:blocked', { hasSessionId: !!sessionId, isLoadingMore });
      return;
    }

    if (detailItem) {
      console.debug('[DEBUG][SearchPage] handleLoadMore:detail-open — closing sheet, scheduling deferred load');
      setDetailItem(null);
      setTimeout(() => {
        console.debug('[DEBUG][SearchPage] handleLoadMore:deferred-fire');
        doLoadMore();
      }, 0);
    } else {
      doLoadMore();
    }
  };

  // Inner async worker — separated so both the immediate and deferred paths
  // share the same logic without duplicating the try/finally cleanup.
  const doLoadMore = async () => {
    console.debug('[DEBUG][SearchPage] doLoadMore:start', { sessionId, isLoadingMore, nextPage });
    if (!sessionId || isLoadingMore) {
      console.debug('[DEBUG][SearchPage] doLoadMore:blocked-early', { hasSessionId: !!sessionId, isLoadingMore });
      return;
    }

    const pageToFetch = nextPage;
    const seq = ++loadMoreSeq.current;
    setIsLoadingMore(true);
    setErrorMessage(null);
    console.debug('[DEBUG][SearchPage] doLoadMore:getSearchPage', { pageToFetch, seq });
    try {
      const response = await getSearchPage(sessionId, pageToFetch);
      console.debug('[DEBUG][SearchPage] doLoadMore:response', { pageToFetch, seq, resultCount: (response.results as any[]).length, creditCost: response.creditCost });
      if (seq !== loadMoreSeq.current) {
        console.debug('[DEBUG][SearchPage] doLoadMore:stale — discarding', { seq, current: loadMoreSeq.current });
        return;
      }
      setResults(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const newItems = (response.results as any[]).filter(r => !existingIds.has(r.id));
        console.debug('[DEBUG][SearchPage] doLoadMore:dedup', { incoming: (response.results as any[]).length, appended: newItems.length, skipped: (response.results as any[]).length - newItems.length });
        return [...prev, ...newItems];
      });
      setNextPage(pageToFetch + 1);
      const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));
      setHasMore(pageToFetch < totalPages);
      if (response.creditCost > 0) {
        refreshProfile();
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.credits });
      }
    } catch (error: any) {
      if (seq !== loadMoreSeq.current) return;
      console.error("[SearchPage] Load more failed:", error);
      if (error.status === 402) {
        setErrorMessage(t("leadLists.insufficientCredits"));
      } else {
        setErrorMessage(t("searchPage.pageLoadFailed"));
      }
    } finally {
      if (seq === loadMoreSeq.current) setIsLoadingMore(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === results.length && results.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map(r => String(r.id)));
    }
  };

  const openListDialog = async () => {
    setIsLoadingLists(true);
    setShowListDialog(true);
    try {
      const { lists } = await getLeadLists();
      setUserLists(lists);
    } catch (error) {
      console.error("[SearchPage] Failed to load lists:", error);
      setErrorMessage(t("leadLists.loadListsFailed"));
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
      toast({ description: t("searchPage.phoneCopied") });
    } catch {
      /* clipboard not available */
    }
  };

  const handleOpenMap = (item: SearchResult) => {
    const query = encodeURIComponent(
      [item.name, item.address || item.district || city].filter(Boolean).join(", ")
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error banner */}
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

      {/* ── Filter Panel ── */}
      <div className="bg-card rounded-xl border shadow-soft p-6 space-y-4">
        {/* Basic filters */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Country (locked, global-ready slot) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Ülke
            </Label>
            <Select value={country} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Türkiye">🇹🇷 Türkiye</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* City / Region */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {t("searchPage.city")}
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-onboarding="city-select" id="city-select">
                <SelectValue placeholder={t("searchPage.selectCity")} />
              </SelectTrigger>
              <SelectContent>
                {turkeyData.provinces.map(province => (
                  <SelectItem key={province.id} value={province.name}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* District / İlçe */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>
                {t("searchPage.district")}
                {city && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(İlçe — isteğe bağlı)</span>
                )}
              </span>
            </Label>
            <Select value={district} onValueChange={setDistrict} disabled={!city}>
              <SelectTrigger data-onboarding="district-select" id="district-select">
                <SelectValue placeholder={
                  city
                    ? `${city} ilçesi seçin (isteğe bağlı)`
                    : "Önce şehir / il seçin"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableDistricts.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {t("searchPage.category")}
            </Label>
            <Input
              data-onboarding="category-input"
              id="category-input"
              type="text"
              placeholder={t("searchPage.categoryPlaceholder")}
              value={category}
              onChange={e => setCategory(e.target.value)}
            />
          </div>
        </div>

        {/* Advanced filters — always visible inline */}
        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t">
          {/* Keyword */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Search className="w-4 h-4 text-muted-foreground" />
              {t("searchPage.keyword")}
            </Label>
            <Input
              id="keyword-input"
              type="text"
              placeholder={t("searchPage.keywordPlaceholder")}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>

          {/* Min rating */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Star className="w-4 h-4 text-muted-foreground" />
              {t("searchPage.minRating")}: {minRating[0].toFixed(1)}
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

          {/* Min reviews */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              {t("searchPage.minReviews")}
            </Label>
            <Input
              id="min-reviews-input"
              type="number"
              min="0"
              placeholder={t("searchPage.minReviewsPlaceholder")}
              value={minReviews}
              onChange={e => {
                const value = Number(e.target.value);
                setMinReviews(value < 0 ? "0" : e.target.value);
              }}
            />
          </div>
        </div>

        {/* Search button */}
        <div className="flex justify-end">
          <Button
            data-onboarding="search-button"
            onClick={handleSearch}
            className="min-w-[140px]"
            disabled={!city || !category || isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("searchPage.searching")}
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {t("searchPage.search")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Results ── */}
      <div ref={resultsRef} className="scroll-mt-4">
        {isSearching ? (
          <div className="bg-card rounded-xl border shadow-soft p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">
                {totalResults.toLocaleString()} sonuç
              </span>
              <span className="text-sm text-muted-foreground">
                {results.length} gösteriliyor
              </span>
              {selectedIds.length > 0 && (
                <span className="text-sm font-medium text-primary">
                  {selectedIds.length} seçili
                </span>
              )}
            </div>
            <Button
              data-onboarding="add-to-list"
              disabled={selectedIds.length === 0}
              size="sm"
              onClick={openListDialog}
            >
              <Plus className="w-4 h-4" />
              Seçilenleri Listeye Ekle
              {selectedIds.length > 0 && ` (${selectedIds.length})`}
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-4 w-10">
                    <Checkbox
                      checked={selectedIds.length === results.length && results.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">İşletme</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Konum</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Kategori</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Puan</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Yorum</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      Lead Potansiyeli
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs space-y-1">
                          <p className="font-semibold">Lead Potansiyeli</p>
                          <p>Görünen sinyallere göre önceliklendirme skoru (0–100). Satış garantisi değildir.</p>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            <li>Yorum hacmi — %45</li>
                            <li>Puan — %30</li>
                            <li>Website — %15</li>
                            <li>Telefon — %10</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">İletişim</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Ek İletişim</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Website</th>
                  <th className="text-left p-4 font-medium text-muted-foreground w-24">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {results.map(item => {

                  const contactStatus = contactStatusConfig[getContactStatus(item)];
                  const enrichmentPotential = enrichmentPotentialConfig[getEnrichmentPotential(item)];
                  const leadScore = computeLeadScore(item);
                  const leadLevel = leadLevelConfig[getLeadLevel(leadScore)];
                  const websiteDisplay = item.website
                    ? item.website.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 24)
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </td>

                      {/* Business name */}
                      <td className="p-4 min-w-[180px]">
                        <div className="font-medium leading-snug">{item.name}</div>
                      </td>

                      {/* Location */}
                      <td className="p-4 min-w-[120px] max-w-[180px]">
                        {(() => {
                          const d = item.district?.trim();
                          const c = city?.trim();
                          const label = formatLocation(d, c);
                          return (
                            <span
                              className="block truncate text-sm text-muted-foreground leading-snug"
                              title={label}
                            >
                              {d && c ? (
                                <>
                                  <span className="font-medium text-foreground">{d}</span>
                                  <span className="block text-xs text-muted-foreground">{c}</span>
                                </>
                              ) : (
                                label
                              )}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Category */}
                      <td className="p-4 text-muted-foreground max-w-[140px] truncate">
                        {item.category || "—"}
                      </td>

                      {/* Rating */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{item.rating ?? "—"}</span>
                        </span>
                      </td>

                      {/* Reviews */}
                      <td className="p-4 text-muted-foreground whitespace-nowrap">
                        {typeof item.reviews === "number" ? item.reviews.toLocaleString() : "—"}
                      </td>

                      {/* Lead Potansiyeli skoru */}
                      <td className="p-4 whitespace-nowrap">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-default ${leadLevel.className}`}>
                              {leadScore}
                              <span className="font-normal opacity-70">{leadLevel.label}</span>
                              <Info className="w-3 h-3 opacity-50" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs space-y-1">
                            <p className="font-semibold">Lead Potansiyeli: {leadScore}/100</p>
                            <p>Görünen sinyallere göre önceliklendirme skoru. Satış garantisi değildir.</p>
                            <ul className="mt-1 space-y-0.5 text-muted-foreground">
                              <li>Yorum hacmi — %45</li>
                              <li>Puan — %30</li>
                              <li>Website — %15</li>
                              <li>Telefon — %10</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </td>

                      {/* Contact status — mevcut veri */}
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${contactStatus.className}`}>
                          {contactStatus.label}
                        </span>
                      </td>

                      {/* Enrichment potential — e-posta/sosyal */}
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${enrichmentPotential.className}`}>
                          {enrichmentPotential.label}
                        </span>
                      </td>

                      {/* Website */}
                      <td className="p-4 max-w-[160px]">
                        {websiteDisplay ? (
                          <a
                            href={`https://${item.website!.replace(/^https?:\/\//, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs truncate block"
                            title={item.website ?? undefined}
                          >
                            {websiteDisplay}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.debug('[DEBUG][SearchPage] detail:open', { itemId: item.id, name: item.name });
                            setDetailItem(item);
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detay
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center items-center gap-3 p-4 border-t bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoadingMore}
                onClick={handleLoadMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Yükleniyor…
                  </>
                ) : (
                  <>Daha Fazla Yükle ({creditsPerPage} kredi)</>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{t("searchPage.emptyTitle")}</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            {t("searchPage.emptyDescription")}
          </p>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      <Sheet open={!!detailItem} onOpenChange={(open) => {
        if (!open) {
          console.debug('[DEBUG][SearchPage] detail:close', { itemId: detailItem?.id ?? null });
          setDetailItem(null);
        }
      }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {detailItem && (
            <div className="animate-slide-in-right space-y-6 pb-6">
              <SheetHeader>
                <SheetTitle className="text-xl leading-snug">{detailItem.name}</SheetTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    {detailItem.category}
                  </span>
                </div>
              </SheetHeader>

              {/* A) Genel */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Genel
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    <span className="font-semibold">{detailItem.rating ?? "—"}</span>
                    <span className="text-muted-foreground text-sm">
                      ({typeof detailItem.reviews === "number" ? detailItem.reviews.toLocaleString() : "—"} yorum)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground leading-relaxed">
                      {detailItem.address ||
                        [detailItem.district, city].filter(Boolean).join(", ") ||
                        "Konum bilgisi mevcut değil"}
                    </span>
                  </div>

                </div>
              </section>

              <div className="border-t" />

              {/* B) İletişim */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  İletişim
                </h4>
                <div className="space-y-3">
                  {/* Phone */}
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Telefon</p>
                      {detailItem.phone ? (
                        <p className="text-sm font-medium">{detailItem.phone}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri bulunamadı</p>
                      )}
                    </div>
                  </div>

                  {/* Website */}
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                      {detailItem.website ? (
                        <a
                          href={`https://${detailItem.website.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          {detailItem.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri bulunamadı</p>
                      )}
                    </div>
                  </div>

                  {/* E-posta + Sosyal: enrichment potansiyeli */}
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">E-posta ve Sosyal Profiller</p>
                      {detailItem.website ? (
                        <p className="text-sm text-violet-700">Zenginleştirme ile alınabilir</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Ek veri kaynağı yok</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div className="border-t" />

              {/* C) Aksiyonlar */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Aksiyonlar
                </h4>
                <div className="space-y-2">
                  {/* Add to list */}
                  <Button
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedIds(prev =>
                        prev.includes(detailItem.id) ? prev : [...prev, detailItem.id]
                      );
                      // Close sheet first, defer dialog open so the sheet portal fully
                      // unmounts before the dialog mounts — prevents focus-lock overlap.
                      setDetailItem(null);
                      setTimeout(() => {
                        console.debug('[DEBUG][SearchPage] detail:listeye-ekle deferred-open');
                        openListDialog();
                      }, 0);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Listeye Ekle
                  </Button>

                  {/* Open website */}
                  {detailItem.website && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        window.open(
                          `https://${detailItem.website!.replace(/^https?:\/\//, "")}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4" />
                      Siteyi Aç
                    </Button>
                  )}

                  {/* Copy phone */}
                  {detailItem.phone && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleCopyPhone(detailItem.phone!)}
                    >
                      <Copy className="w-4 h-4" />
                      {copiedPhone ? "Kopyalandı!" : "Telefonu Kopyala"}
                    </Button>
                  )}

                  {/* Open maps */}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleOpenMap(detailItem)}
                  >
                    <Navigation className="w-4 h-4" />
                    Haritada Aç
                  </Button>

                  {/* Mark for enrichment — adds to selection so user can batch-enrich from ListDetail */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => {
                      setSelectedIds(prev =>
                        prev.includes(detailItem.id) ? prev : [...prev, detailItem.id]
                      );
                      setDetailItem(null);
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    {t("searchPage.markForEnrichment")}
                  </Button>
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── List Selection Dialog ── */}
      <Dialog
        open={showListDialog}
        onOpenChange={open => {
          setShowListDialog(open);
          if (!open) {
            setSelectedListId("");
            setDryRunCost(null);
            setListDialogError(null);
            setNewListName("");
            setIsCreatingList(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leadLists.addToListTitle")}</DialogTitle>
            <DialogDescription>
              {t("leadLists.leadsSelected", { count: selectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingLists ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Inline new-list creation */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t("leadLists.newListNamePlaceholder")}
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    disabled={isCreatingList}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!newListName.trim() || isCreatingList}
                    onClick={async () => {
                      setIsCreatingList(true);
                      setListDialogError(null);
                      try {
                        const { list } = await createLeadList(newListName.trim());
                        setUserLists(prev => [list, ...prev]);
                        setNewListName("");
                        setSelectedListId(list.id);
                        setDryRunCost(null);
                        try {
                          const selectedLeads = results.filter(r => selectedIds.includes(r.id));
                          const dryRunResult = await addLeadsToList(list.id, selectedLeads, { dryRun: true });
                          setDryRunCost(dryRunResult.creditCost || 0);
                        } catch { /* dry-run failure is non-fatal */ }
                      } catch (error) {
                        console.error("[SearchPage] Create list failed:", error);
                        setListDialogError(t("leadLists.createListFailed"));
                      } finally {
                        setIsCreatingList(false);
                      }
                    }}
                  >
                    {isCreatingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Existing list selector */}
                {userLists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">{t("leadLists.noListsYet")}</p>
                ) : (
                  <Select
                    value={selectedListId}
                    onValueChange={async listId => {
                      setSelectedListId(listId);
                      setDryRunCost(null);
                      try {
                        const selectedLeads = results.filter(r => selectedIds.includes(r.id));
                        const dryRunResult = await addLeadsToList(listId, selectedLeads, { dryRun: true });
                        setDryRunCost(dryRunResult.creditCost || 0);
                      } catch (error) {
                        console.error("[SearchPage] DryRun failed:", error);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("leadLists.selectList")} />
                    </SelectTrigger>
                    <SelectContent>
                      {userLists.map(list => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.lead_count} lead)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}

            {dryRunCost !== null && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium">{t("leadLists.costLabel", { cost: dryRunCost })}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dryRunCost === 0
                    ? t("leadLists.allDuplicates")
                    : t("leadLists.willAddN", { count: dryRunCost })}
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
            <Button
              variant="outline"
              onClick={() => {
                setShowListDialog(false);
                setSelectedListId("");
                setDryRunCost(null);
                setListDialogError(null);
              }}
            >
              {t("common.cancel")}
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

                  setErrorMessage(
                    result.skippedCount
                      ? t("leadLists.addSuccessWithSkipped", { added: result.addedCount, skipped: result.skippedCount })
                      : t("leadLists.addSuccess", { count: result.addedCount })
                  );
                  setTimeout(() => setErrorMessage(null), 5000);
                } catch (error: any) {
                  console.error("[SearchPage] Add to list failed:", error);
                  if (error.status === 402) {
                    const requiredText = error.required ? ` ${error.required} kredi gerekli,` : "";
                    const availableText = error.available !== undefined ? ` ${error.available} kredi mevcut.` : "";
                    setListDialogError(t("leadLists.insufficientCredits") + requiredText + availableText);
                  } else {
                    setListDialogError(t("leadLists.addFailed"));
                  }
                } finally {
                  setIsAddingToList(false);
                }
              }}
            >
              {isAddingToList ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("leadLists.adding")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("leadLists.addButtonWithCost", { cost: dryRunCost ?? "?" })}
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
      {showOnboarding && profile && !profile.onboarding_completed && (
        <OnboardingTour onComplete={handleOnboardingComplete} />
      )}
      </div>{/* /resultsRef */}
    </div>
  );
}
