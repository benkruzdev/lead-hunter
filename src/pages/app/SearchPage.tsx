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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Check,
  ChevronsUpDown,
  ChevronDown,
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
import { getLocationData } from "@/lib/locationData";
import { useToast } from "@/hooks/use-toast";
import { ExportTemplateDialog } from "@/components/app/ExportTemplateDialog";
import { templates, mapItemToRecord, generateCSV, downloadCSV } from "@/lib/exportTemplates";
import { COUNTRY_BY_CODE, VISIBLE_COUNTRIES } from "@/config/countries";

// Extracted UI Components
import { SearchFilterPanel } from "@/components/app/SearchFilterPanel";
import { SearchResultsTable } from "@/components/app/SearchResultsTable";
import { SearchDetailDrawer } from "@/components/app/SearchDetailDrawer";



// ─── Component ───────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Location state ──
  // country: ISO code (from src/config/countries.ts)
  // city / district: structured dropdown for TR, free-text for others
  const [country, setCountry] = useState("TR");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  // Derived helpers — locationData is non-null when a structured dataset exists.
  // null → free-text city + district inputs (Google handles geo-context).
  const countryEntry = COUNTRY_BY_CODE.get(country);
  const locationData = getLocationData(country);
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

  // maxCreditsPerBatch: worst-case credit cost for one result batch (up to 20 records).
  // Sourced from /credit-cost → max_credits_per_batch. Used in the load-more CTA label.
  // Actual charge is always ≤ this — exact number of newly returned businesses.
  const [maxCreditsPerBatch, setMaxCreditsPerBatch]     = useState(20);
  const [creditsPerEnrichment, setCreditsPerEnrichment] = useState(1);
  // Tracks which page numbers have already been viewed (fetched) in this session.
  // Pages in this set were already paid for — Load More won't charge for them again.
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set([1]));

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
    if (!locationData) {
      // No structured dataset for this country — free-text inputs, no dropdown
      setAvailableDistricts([]);
      return;
    }
    if (city) {
      const districts = locationData.subregions[city] || [];
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
  }, [city, pendingDistrict, locationData]);

  // When country changes: clear city/district so the form stays coherent
  useEffect(() => {
    setCity("");
    setDistrict("");
    setAvailableDistricts([]);
    setPendingDistrict(null);
  }, [country]);

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
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const { session } = await getSearchSession(sid);
      if (seq !== reqSeq.current) return;

      // Restore country — old sessions without country_code default to TR
      const restoredCountry = session.country_code ?? "TR";
      setCountry(restoredCountry);
      setCity(session.province || "");
      setPendingDistrict(session.district || null);
      setCategory(session.category || "");
      setKeyword(session.keyword || "");
      setMinRating([session.min_rating || 0]);
      setMinReviews(session.min_reviews ? session.min_reviews.toString() : "");
      setSessionId(sid);
      setTotalResults(session.total_results);
      setHasSearched(true);
      setSelectedIds([]);

      getSearchCreditCost().then(costs => {
        setMaxCreditsPerBatch(costs.max_credits_per_batch ?? costs.credits_per_page ?? 20);
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
        countryCode: restoredCountry,
      });

      if (seq !== reqSeq.current) return;
      setResults(searchResponse.results);
      // totalResults kept for internal compatibility (session record, history).
      // It is NOT the driver of pagination UX — hasMore below is.
      const total = searchResponse.totalResults ?? session.total_results;
      setTotalResults(total);
      // Seed viewedPages from the session so the button label knows which pages
      // have already been paid for. nextPage stays at 2 because restore always
      // renders only the first page — the user re-loads subsequent pages one by
      // one via Load More, in order, even if they were previously viewed.
      const alreadyViewed = Array.isArray(session.viewed_pages) ? session.viewed_pages : [1];
      setViewedPages(new Set(alreadyViewed));
      setNextPage(2);
      // Backend hasMore flag is strictly authoritative.
      setHasMore(searchResponse.hasMore);
    } catch (error: any) {
      if (seq !== reqSeq.current) return;
      console.error('[SearchPage] loadSession failed:', { sid, status: error?.status, message: error?.message });
      if (error.status === 410) {
        navigate("/app/history", { replace: true });
      } else {
        setErrorMessage(t("searchPage.sessionLoadFailed"));
      }
    } finally {
      if (seq === reqSeq.current) setIsSearching(false);
    }
  }, [navigate, t]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleSearch = async () => {
    const seq = ++reqSeq.current;
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
        countryCode: country,
      });

      if (seq !== reqSeq.current) return;
      setSessionId(response.sessionId);
      setResults(response.results as any[]);
      setTotalResults(response.totalResults);
      setNextPage(2);
      // The backend's authoritative hasMore is deterministic.
      setHasMore(response.hasMore);
      setHasSearched(true);
      // Page 1 was just served — mark it viewed so the credit label shows correctly.
      setViewedPages(new Set([1]));

      getSearchCreditCost().then(costs => {
        setMaxCreditsPerBatch(costs.max_credits_per_batch ?? costs.credits_per_page ?? 20);
        setCreditsPerEnrichment(costs.credits_per_enrichment);
      }).catch(() => { /* keep defaults */ });

      refreshProfile();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.credits });
    } catch (error: any) {
      if (seq !== reqSeq.current) return;
      console.error('[SearchPage] handleSearch failed:', { seq, status: error?.status, message: error?.message });
      setErrorMessage(t("searchPage.searchFailed"));
    } finally {
      if (seq === reqSeq.current) setIsSearching(false);
    }
  };

  const handleExportConfirm = (templateId: "basic" | "salesCrm" | "outreach") => {
    const template = templates[templateId];
    const selectedItems = results.filter(item => selectedIds.includes(item.id));
    const records = selectedItems.map(item => mapItemToRecord(item, template, {
      city,
      country: countryEntry?.name,
      countryCode: country || undefined,
    }));
    const csvContent = generateCSV(records, template.columns);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `leads_${templateId}_${timestamp}.csv`;
    downloadCSV(csvContent, filename);
  };


  // ── Load More ──
  const handleLoadMore = () => {
    if (!sessionId || isLoadingMore) return;

    if (detailItem) {
      setDetailItem(null);
      setTimeout(() => { doLoadMore(); }, 0);
    } else {
      doLoadMore();
    }
  };

  // Inner async worker — separated so both the immediate and deferred paths
  // share the same logic without duplicating the try/finally cleanup.
  const doLoadMore = async () => {
    if (!sessionId || isLoadingMore) return;

    const pageToFetch = nextPage;
    const seq = ++loadMoreSeq.current;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const response = await getSearchPage(sessionId, pageToFetch);
      if (seq !== loadMoreSeq.current) return;
      setResults(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const newItems = (response.results as any[]).filter(r => !existingIds.has(r.id));
        return [...prev, ...newItems];
      });
      setNextPage(pageToFetch + 1);
      // Mark this page as viewed so the credit label updates correctly.
      setViewedPages(prev => new Set([...prev, pageToFetch]));
      // Rely explicitly on backend hasMore flag.
      setHasMore(response.hasMore);
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
      <SearchFilterPanel
        country={country} setCountry={setCountry}
        city={city} setCity={setCity}
        district={district} setDistrict={setDistrict}
        availableDistricts={availableDistricts}
        category={category} setCategory={setCategory}
        keyword={keyword} setKeyword={setKeyword}
        minRating={minRating} setMinRating={setMinRating}
        minReviews={minReviews} setMinReviews={setMinReviews}
        isSearching={isSearching} handleSearch={handleSearch}
        countryEntry={countryEntry} locationData={locationData ?? null}
      />

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
          <SearchResultsTable
            results={results}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            onOpenDetail={setDetailItem}
            onAddToList={openListDialog}
            city={city}
            countryName={countryEntry?.name}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            viewedPages={viewedPages}
            nextPage={nextPage}
            maxCreditsPerBatch={maxCreditsPerBatch}
          />
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
      <SearchDetailDrawer
        item={detailItem}
        onClose={() => {
          console.debug('[DEBUG][SearchPage] detail:close', { itemId: detailItem?.id ?? null });
          setDetailItem(null);
        }}
        city={city}
        countryEntry={countryEntry}
        onAddToListClick={(item) => {
          setSelectedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
          setDetailItem(null);
          setTimeout(() => {
            console.debug('[DEBUG][SearchPage] detail:add-to-list deferred-open');
            openListDialog();
          }, 0);
        }}
        onCopyPhone={handleCopyPhone}
        copiedPhone={copiedPhone}
      />

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
                    const parts = [t("leadLists.insufficientCredits")];
                    if (error.required != null) parts.push(t("searchPage.creditErrorRequired", { required: error.required }));
                    if (error.available != null) parts.push(t("searchPage.creditErrorAvailable", { available: error.available }));
                    setListDialogError(parts.join(" "));
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
