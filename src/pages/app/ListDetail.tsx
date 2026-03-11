import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  FileDown,
  Trash2,
  Loader2,
  Tags,
  StickyNote,
  Pencil,
  Zap,
  Phone,
  Globe,
  Mail,
  MapPin,
  Star,
  MessageSquare,
  Clock,
  Copy,
  ExternalLink,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
} from "lucide-react";
import {
  getLeadListItems,
  getLeadList,
  bulkUpdateListItems,
  bulkDeleteListItems,
  enrichLeadListItem,
  createExport,
  getSearchCreditCost,
  LeadListItem,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─────────────────────────────────────────────
// Pure helper functions (component-external)
// ─────────────────────────────────────────────

/** Safe accessor for raw search data stored on a list item. */
function raw(item: LeadListItem): Record<string, any> {
  return (item.raw as Record<string, any>) ?? {};
}

function getCategory(item: LeadListItem): string {
  return raw(item).category ?? "";
}

function getDistrict(item: LeadListItem): string {
  return raw(item).district ?? "";
}

function getProvince(item: LeadListItem): string {
  return raw(item).province ?? raw(item).city ?? "";
}

function getAddress(item: LeadListItem): string {
  return raw(item).address ?? raw(item).formatted_address ?? "";
}

function getHours(item: LeadListItem): string {
  return raw(item).hours ?? raw(item).opening_hours_text ?? "";
}

/** True when the item has at least phone or website. */
function hasContactData(item: LeadListItem): boolean {
  return !!(item.phone || item.website);
}

/** Enrichment eligibility: item has a website but hasn't been enriched yet. */
function isEnrichmentEligible(item: LeadListItem): boolean {
  return !!(item.website && item.enrichment_status == null);
}

/** Has secondary contact (email or social links from enrichment). */
function hasExtraContact(item: LeadListItem): boolean {
  return !!(
    item.email ||
    (item.social_links && Object.values(item.social_links).some(Boolean))
  );
}

/** Count social links that have a value. */
function socialCount(item: LeadListItem): number {
  if (!item.social_links) return 0;
  return Object.values(item.social_links).filter(Boolean).length;
}

type ScoreTier = "high" | "mid" | "low";

/**
 * Deterministic lead potential score (0–100) based only on reliable data fields.
 * phone +30 · website +25 · rating≥4 +20 · reviews_count≥10 +15 · email +10
 */
function computeScore(item: LeadListItem): number {
  let score = 0;
  if (item.phone) score += 30;
  if (item.website) score += 25;
  if ((item.rating ?? 0) >= 4) score += 20;
  if ((item.reviews_count ?? 0) >= 10) score += 15;
  if (item.email) score += 10;
  return score;
}

function scoreTier(score: number): ScoreTier {
  if (score >= 60) return "high";
  if (score >= 30) return "mid";
  return "low";
}

function ensureHttps(url: string): string {
  if (!url) return url;
  return url.startsWith("http") ? url : `https://${url}`;
}

type FilterKey = "all" | "withDetails" | "missing" | "enrichable";
type SortKey = "score" | "newest" | "alpha";

// ─────────────────────────────────────────────
// Summary metrics helper
// ─────────────────────────────────────────────

function computeMetrics(items: LeadListItem[]) {
  const total = items.length;
  const withDetails = items.filter(
    (i) => i.enrichment_status === "success"
  ).length;
  const withPhone = items.filter((i) => !!i.phone).length;
  const withWebsite = items.filter((i) => !!i.website).length;
  const enrichable = items.filter(isEnrichmentEligible).length;
  return { total, withDetails, withPhone, withWebsite, enrichable };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ListDetail() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("tr") ? "tr-TR" : "en-US";
  const params = useParams<{ listId?: string; id?: string }>();
  const listId = (params.listId || params.id) as string | undefined;

  const [items, setItems] = useState<LeadListItem[]>([]);
  const [listName, setListName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");

  // Detail drawer
  const [detailItem, setDetailItem] = useState<LeadListItem | null>(null);

  // Per-row edit state
  const [editTarget, setEditTarget] = useState<LeadListItem | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Per-row delete state
  const [deleteTarget, setDeleteTarget] = useState<LeadListItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Bulk dialog states
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkNoteDialog, setShowBulkNoteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkNoteInput, setBulkNoteInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Bulk enrich state
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [bulkEnrichProgress, setBulkEnrichProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Enrichment state
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [enrichItemId, setEnrichItemId] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [exportNote, setExportNote] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [creditsPerEnrichment, setCreditsPerEnrichment] = useState(1);

  useEffect(() => {
    if (listId) {
      loadItems();
    } else {
      setError(t("leadLists.missingListId"));
      setIsLoading(false);
    }
    getSearchCreditCost()
      .then((c) => setCreditsPerEnrichment(c.credits_per_enrichment))
      .catch(() => {});
  }, [listId]);

  const loadItems = async () => {
    if (!listId) {
      setError(t("leadLists.missingListId"));
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      // Fetch list meta (name) and items in parallel
      const [listRes, itemsRes] = await Promise.all([
        getLeadList(listId).catch(() => null),
        getLeadListItems(listId),
      ]);
      if (listRes?.list?.name) setListName(listRes.list.name);
      const itemsArray = Array.isArray(itemsRes)
        ? itemsRes
        : ((itemsRes as any).items ?? (itemsRes as any).leadItems ?? []);
      setItems(itemsArray);
    } catch (err: any) {
      console.error("[ListDetail] Failed to load items:", err);
      setError(err?.message || t("leadLists.loadItemsFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Selection ──────────────────────────────
  const handleSelectAll = (checked: boolean) => {
    setSelectedItemIds(
      checked ? visibleItems.map((item) => item.id) : []
    );
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) =>
      checked ? [...prev, itemId] : prev.filter((id) => id !== itemId)
    );
  };

  // ── Bulk actions ───────────────────────────
  const handleBulkTag = async () => {
    const tags = bulkTagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tags.length === 0) return;
    try {
      setIsProcessing(true);
      await bulkUpdateListItems(listId!, selectedItemIds, { tags });
      await loadItems();
      setShowBulkTagDialog(false);
      setBulkTagInput("");
      setSelectedItemIds([]);
    } catch (error) {
      console.error("[ListDetail] Bulk tag failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkNote = async () => {
    const note = bulkNoteInput.trim();
    if (note.length === 0) return;
    try {
      setIsProcessing(true);
      await bulkUpdateListItems(listId!, selectedItemIds, { note });
      await loadItems();
      setShowBulkNoteDialog(false);
      setBulkNoteInput("");
      setSelectedItemIds([]);
    } catch (error) {
      console.error("[ListDetail] Bulk note failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setIsProcessing(true);
      await bulkDeleteListItems(listId!, selectedItemIds);
      await loadItems();
      setShowBulkDeleteDialog(false);
      setSelectedItemIds([]);
    } catch (error) {
      console.error("[ListDetail] Bulk delete failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkEnrich = async () => {
    // If items are selected, use them; otherwise fall back to all enrichment-eligible items.
    const candidates =
      selectedItemIds.length > 0
        ? items.filter(
            (item) =>
              selectedItemIds.includes(item.id) && item.enrichment_status == null
          )
        : items.filter((item) => item.enrichment_status == null && !!item.website);

    if (candidates.length === 0) {
      // Nothing eligible — no-op, clear selection if any
      setSelectedItemIds([]);
      return;
    }

    const ids = candidates.map((item) => item.id);
    setIsBulkEnriching(true);
    setBulkEnrichProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        await enrichLeadListItem(listId!, ids[i]);
      } catch {
        // continue on per-item error (e.g. no website, 402)
      }
      setBulkEnrichProgress({ done: i + 1, total: ids.length });
    }
    await loadItems();
    setIsBulkEnriching(false);
    setBulkEnrichProgress(null);
    setSelectedItemIds([]);
    refreshProfile();
  };

  // ── Per-row actions ────────────────────────
  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      setIsSavingEdit(true);
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await bulkUpdateListItems(listId!, [editTarget.id], {
        note: editNote,
        tags,
      });
      await loadItems();
      setEditTarget(null);
    } catch (error) {
      console.error("[ListDetail] Edit failed:", error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeletingSingle(true);
      await bulkDeleteListItems(listId!, [deleteTarget.id]);
      await loadItems();
      setDeleteTarget(null);
      if (detailItem?.id === deleteTarget.id) setDetailItem(null);
    } catch (error) {
      console.error("[ListDetail] Single delete failed:", error);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleEnrich = async () => {
    if (!enrichItemId || !listId) return;
    try {
      setIsEnriching(true);
      setEnrichError(null);
      const result = await enrichLeadListItem(listId, enrichItemId);
      await loadItems();
      setShowEnrichDialog(false);
      setEnrichItemId(null);
      if (result.status === "success") {
        refreshProfile();
      }
    } catch (error: any) {
      console.error("[ListDetail] Enrichment failed:", error);
      if (error.status === 402) {
        setEnrichError(t("leadEnrichment.insufficientCredits"));
      } else {
        setEnrichError(t("leadEnrichment.failed"));
      }
    } finally {
      setIsEnriching(false);
    }
  };

  const handleExport = async () => {
    if (!listId) return;
    try {
      setIsExporting(true);
      setExportError(null);
      const result = await createExport(listId, exportFormat, exportNote || undefined);
      window.location.href = result.downloadUrl;
      setShowExportDialog(false);
      setExportFormat("csv");
      setExportNote("");
    } catch (error: any) {
      console.error("[ListDetail] Export failed:", error);
      setExportError(error.message || t("exports.createFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).catch(() => {});
    toast({ description: t("listDetail.phoneCopied") });
  };

  // ── Derived data ───────────────────────────
  const metrics = useMemo(() => computeMetrics(items), [items]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let filtered = q
      ? items.filter((i) => (i.name ?? "").toLowerCase().includes(q))
      : items;

    if (filterKey === "withDetails") {
      filtered = filtered.filter((i) => i.enrichment_status === "success");
    } else if (filterKey === "missing") {
      filtered = filtered.filter((i) => !hasContactData(i));
    } else if (filterKey === "enrichable") {
      filtered = filtered.filter(isEnrichmentEligible);
    }

    const sorted = [...filtered];
    if (sortKey === "score") {
      sorted.sort((a, b) => computeScore(b) - computeScore(a));
    } else if (sortKey === "newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      sorted.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
        })
      );
    }
    return sorted;
  }, [items, searchQuery, filterKey, sortKey]);

  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((i) => selectedItemIds.includes(i.id));

  // How many items are eligible for enrichment from the header button's perspective
  const headerEnrichCount =
    selectedItemIds.length > 0
      ? items.filter(
          (i) => selectedItemIds.includes(i.id) && i.enrichment_status == null
        ).length
      : items.filter((i) => i.enrichment_status == null && !!i.website).length;

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────

  function StatusBadge({ item }: { item: LeadListItem }) {
    if (item.enrichment_status === "success") {
      return (
        <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {t("listDetail.statusFound")}
        </Badge>
      );
    }
    if (item.enrichment_status === "failed") {
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
          <XCircle className="w-3 h-3" />
          {t("listDetail.statusNoSource")}
        </Badge>
      );
    }
    if (hasContactData(item)) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <AlertCircle className="w-3 h-3" />
          {t("listDetail.statusPartial")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        {t("listDetail.statusMissing")}
      </Badge>
    );
  }

  function ScoreBadge({ item }: { item: LeadListItem }) {
    const score = computeScore(item);
    const tier = scoreTier(score);
    const colorMap: Record<ScoreTier, string> = {
      high: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      mid: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
      low: "bg-muted text-muted-foreground",
    };
    const labelKey: Record<ScoreTier, string> = {
      high: "listDetail.scoreHigh",
      mid: "listDetail.scoreMid",
      low: "listDetail.scoreLow",
    };
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge
              className={`text-xs cursor-default ${colorMap[tier]}`}
            >
              {t(labelKey[tier])} · {score}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs max-w-[200px]">{t("listDetail.scoreTooltip")}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // ─────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5 animate-fade-in">

        {/* ── Header ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0 flex items-start gap-4">
            <Link to="/app/lists" className="shrink-0 mt-0.5">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" />
                {t("listDetail.back")}
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate">
                {listName ?? t("listDetail.title")}
              </h2>
              {!isLoading && !error && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                  <span><span className="font-medium text-foreground">{metrics.total}</span> {t("listDetail.leads")}</span>
                  <span>·</span>
                  <span><span className="font-medium text-foreground">{metrics.withDetails}</span> {t("listDetail.withDetails")}</span>
                  <span>·</span>
                  <span><span className="font-medium text-foreground">{metrics.withPhone}</span> {t("listDetail.withPhone")}</span>
                  <span>·</span>
                  <span><span className="font-medium text-foreground">{metrics.withWebsite}</span> {t("listDetail.withWebsite")}</span>
                  <span>·</span>
                  <span><span className="font-medium text-foreground">{metrics.enrichable}</span> {t("listDetail.enrichable")}</span>
                </div>
              )}
            </div>
          </div>
          {/* Right CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkEnrich}
              disabled={isBulkEnriching || headerEnrichCount === 0}
            >
              <Zap className="w-4 h-4" />
              {isBulkEnriching && bulkEnrichProgress
                ? `${bulkEnrichProgress.done}/${bulkEnrichProgress.total}`
                : selectedItemIds.length > 0
                ? t("listDetail.enrichSelected", { count: headerEnrichCount })
                : t("listDetail.enrichAll", { count: headerEnrichCount })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <FileDown className="w-4 h-4" />
              {t("exports.create")}
            </Button>
          </div>
        </div>

        {/* ── Content ─────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadItems}>{t("common.retry")}</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">{t("listDetail.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("listDetail.emptyDesc")}</p>
            <Link to="/app/search">
              <Button>{t("listDetail.goSearch")}</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Summary metrics ─────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Users, label: t("listDetail.statTotal"), val: metrics.total, color: "text-primary", bg: "bg-primary/10" },
                { icon: CheckCircle2, label: t("listDetail.statWithDetails"), val: metrics.withDetails, color: "text-emerald-600", bg: "bg-emerald-500/10" },
                { icon: Phone, label: t("listDetail.statPhone"), val: metrics.withPhone, color: "text-blue-600", bg: "bg-blue-500/10" },
                { icon: Globe, label: t("listDetail.statWebsite"), val: metrics.withWebsite, color: "text-violet-600", bg: "bg-violet-500/10" },
                { icon: Zap, label: t("listDetail.statEnrichable"), val: metrics.enrichable, color: "text-amber-600", bg: "bg-amber-500/10" },
              ].map(({ icon: Icon, label, val, color, bg }) => (
                <div key={label} className="bg-card border rounded-lg p-3.5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{label}</p>
                    <p className="text-lg font-bold leading-tight">{val}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Bulk action bar ──────────────── */}
            {selectedItemIds.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-primary">
                  {t("listDetail.bulkSelected", { count: selectedItemIds.length })}
                </p>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkEnrich}
                    disabled={isBulkEnriching}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isBulkEnriching && bulkEnrichProgress
                      ? `${bulkEnrichProgress.done}/${bulkEnrichProgress.total}`
                      : t("listDetail.bulkEnrich")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowBulkTagDialog(true)}>
                    <Tags className="w-3.5 h-3.5" />
                    {t("listDetail.bulkTag")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowBulkNoteDialog(true)}>
                    <StickyNote className="w-3.5 h-3.5" />
                    {t("listDetail.bulkNote")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("listDetail.bulkRemove")}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Filter & sort bar ────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder={t("listDetail.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterKey} onValueChange={(v) => setFilterKey(v as FilterKey)}>
                <SelectTrigger className="w-full sm:w-52">
                  <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("listDetail.filterAll")}</SelectItem>
                  <SelectItem value="withDetails">{t("listDetail.filterWithDetails")}</SelectItem>
                  <SelectItem value="missing">{t("listDetail.filterMissing")}</SelectItem>
                  <SelectItem value="enrichable">{t("listDetail.filterEnrichable")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">{t("listDetail.sortScore")}</SelectItem>
                  <SelectItem value="newest">{t("listDetail.sortNewest")}</SelectItem>
                  <SelectItem value="alpha">{t("listDetail.sortAlpha")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── No filter results ────────────── */}
            {visibleItems.length === 0 ? (
              <div className="bg-card rounded-xl border p-10 text-center">
                <p className="text-sm text-muted-foreground mb-3">{t("listDetail.noFilterResults")}</p>
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilterKey("all"); }}>
                  {t("listDetail.clearFilters")}
                </Button>
              </div>
            ) : (
              /* ── Table ──────────────────────── */
              <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="p-3 w-10">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label={t("listDetail.selectAll")}
                          />
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("listDetail.colBusiness")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                          {t("listDetail.colLocation")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("listDetail.colPotential")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("listDetail.colContact")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                          {t("listDetail.colExtra")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("listDetail.colStatus")}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("listDetail.colActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const district = getDistrict(item);
                        const province = getProvince(item);
                        const category = getCategory(item);
                        const enrEligible = isEnrichmentEligible(item);
                        const extrasCount = socialCount(item);

                        return (
                          <tr
                            key={item.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setDetailItem(item)}
                          >
                            {/* Checkbox */}
                            <td
                              className="p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedItemIds.includes(item.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectItem(item.id, checked as boolean)
                                }
                              />
                            </td>

                            {/* Business */}
                            <td className="p-3 max-w-[180px]">
                              <p className="text-sm font-semibold truncate" title={item.name ?? ""}>
                                {item.name ?? "—"}
                              </p>
                              {category && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {category}
                                </p>
                              )}
                            </td>

                            {/* Location */}
                            <td className="p-3 hidden md:table-cell max-w-[140px]">
                              {district || province ? (
                                <div className="text-xs leading-snug">
                                  {district && (
                                    <p className="font-medium text-foreground truncate">{district}</p>
                                  )}
                                  {province && (
                                    <p className="text-muted-foreground truncate">{province}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Potential score */}
                            <td className="p-3">
                              <ScoreBadge item={item} />
                            </td>

                            {/* Contact */}
                            <td className="p-3">
                              {hasContactData(item) ? (
                                <div className="flex flex-col gap-1">
                                  {item.phone && (
                                    <span className="flex items-center gap-1 text-xs">
                                      <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="truncate max-w-[100px]">{item.phone}</span>
                                    </span>
                                  )}
                                  {item.website && (
                                    <span className="flex items-center gap-1 text-xs">
                                      <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <a
                                        href={ensureHttps(item.website)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline truncate max-w-[100px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {item.website.replace(/^https?:\/\//, "").split("/")[0]}
                                      </a>
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t("listDetail.noContact")}
                                </span>
                              )}
                            </td>

                            {/* Extra contact */}
                            <td className="p-3 hidden lg:table-cell">
                              {item.email || extrasCount > 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  {item.email && extrasCount > 0
                                    ? `${t("listDetail.email")} + ${extrasCount} ${t("listDetail.social")}`
                                    : item.email
                                    ? t("listDetail.emailOnly")
                                    : `${extrasCount} ${t("listDetail.social")}`}
                                </Badge>
                              ) : enrEligible ? (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                  {t("listDetail.enrichPossible")}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t("listDetail.noExtraSource")}
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3">
                              <StatusBadge item={item} />
                            </td>

                            {/* Actions */}
                            <td
                              className="p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title={t("listDetail.editAction")}
                                  onClick={() => {
                                    setEditTarget(item);
                                    setEditNote(item.note || "");
                                    setEditTags((item.tags || []).join(", "));
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {item.enrichment_status == null && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-amber-600 hover:text-amber-600"
                                    title={t("leadEnrichment.title")}
                                    onClick={() => {
                                      setEnrichItemId(item.id);
                                      setShowEnrichDialog(true);
                                      setEnrichError(null);
                                    }}
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title={t("listDetail.removeAction")}
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────
          Detail Drawer (Sheet-style dialog)
        ───────────────────────────────────────── */}
        <Dialog
          open={!!detailItem}
          onOpenChange={(open) => { if (!open) setDetailItem(null); }}
        >
          <DialogContent className="max-w-md">
            {detailItem && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold line-clamp-2">
                    {detailItem.name ?? "—"}
                  </DialogTitle>
                  {getCategory(detailItem) && (
                    <DialogDescription>{getCategory(detailItem)}</DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-1">
                  {/* ── General ── */}
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t("listDetail.sectionGeneral")}
                    </h4>
                    <div className="space-y-2">
                      {(detailItem.rating != null || detailItem.reviews_count != null) && (
                        <div className="flex items-center gap-3 text-sm">
                          {detailItem.rating != null && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              {detailItem.rating.toFixed(1)}
                            </span>
                          )}
                          {detailItem.reviews_count != null && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {detailItem.reviews_count.toLocaleString(lang)}
                            </span>
                          )}
                        </div>
                      )}
                      {getAddress(detailItem) && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{getAddress(detailItem)}</span>
                        </div>
                      )}
                      {getHours(detailItem) && (
                        <div className="flex items-start gap-2 text-sm">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{getHours(detailItem)}</span>
                        </div>
                      )}
                      {detailItem.note && (
                        <div className="flex items-start gap-2 text-sm">
                          <StickyNote className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{detailItem.note}</span>
                        </div>
                      )}
                      {detailItem.tags && detailItem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {detailItem.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── Contact ── */}
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t("listDetail.sectionContact")}
                    </h4>
                    <div className="space-y-2">
                      {detailItem.phone ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1">{detailItem.phone}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("listDetail.noPhone")}</p>
                      )}
                      {detailItem.website ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={ensureHttps(detailItem.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate flex-1"
                          >
                            {detailItem.website}
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("listDetail.noWebsite")}</p>
                      )}
                      {detailItem.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{detailItem.email}</span>
                        </div>
                      )}
                      {detailItem.social_links && Object.entries(detailItem.social_links).some(([, v]) => v) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Object.entries(detailItem.social_links).map(([platform, url]) =>
                            url ? (
                              <a
                                key={platform}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline capitalize"
                              >
                                {platform}
                              </a>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── Actions ── */}
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t("listDetail.sectionActions")}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detailItem.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyPhone(detailItem.phone!)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {t("listDetail.copyPhone")}
                        </Button>
                      )}
                      {detailItem.website && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={ensureHttps(detailItem.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("listDetail.openWebsite")}
                          </a>
                        </Button>
                      )}
                      {getAddress(detailItem) && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(getAddress(detailItem))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {t("listDetail.openMap")}
                          </a>
                        </Button>
                      )}
                      {isEnrichmentEligible(detailItem) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => {
                            setEnrichItemId(detailItem.id);
                            setShowEnrichDialog(true);
                            setEnrichError(null);
                            setDetailItem(null);
                          }}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {t("listDetail.enrichAction")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget(detailItem);
                          setDetailItem(null);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("listDetail.removeAction")}
                      </Button>
                    </div>
                  </section>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────
          Per-row Edit Dialog
        ───────────────────────────────────────── */}
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("listDetail.editTitle")}</DialogTitle>
              <DialogDescription>{editTarget?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("listDetail.editNoteLabel")}</label>
                <Textarea
                  placeholder={t("listDetail.editNotePlaceholder")}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("listDetail.editTagsLabel")}</label>
                <Input
                  placeholder={t("listDetail.editTagsPlaceholder")}
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSavingEdit}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Per-row Delete Confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("listDetail.removeTitle")}</DialogTitle>
              <DialogDescription>
                {t("listDetail.removeDesc", { name: deleteTarget?.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeletingSingle}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleSingleDelete} disabled={isDeletingSingle}>
                {isDeletingSingle ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("listDetail.removeConfirm")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Tag Dialog */}
        <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("listDetail.bulkTagTitle")}</DialogTitle>
              <DialogDescription>
                {t("listDetail.bulkTagDesc", { count: selectedItemIds.length })}
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder={t("listDetail.bulkTagPlaceholder")}
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleBulkTag}
                disabled={isProcessing || bulkTagInput.trim().length === 0}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("listDetail.apply")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Note Dialog */}
        <Dialog open={showBulkNoteDialog} onOpenChange={setShowBulkNoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("listDetail.bulkNoteTitle")}</DialogTitle>
              <DialogDescription>
                {t("listDetail.bulkNoteDesc", { count: selectedItemIds.length })}
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder={t("listDetail.bulkNotePlaceholder")}
              value={bulkNoteInput}
              onChange={(e) => setBulkNoteInput(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkNoteDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleBulkNote}
                disabled={isProcessing || bulkNoteInput.trim().length === 0}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("listDetail.apply")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Dialog */}
        <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("listDetail.bulkDeleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("listDetail.bulkDeleteDesc", { count: selectedItemIds.length })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enrichment Dialog */}
        <Dialog
          open={showEnrichDialog}
          onOpenChange={(open) => {
            setShowEnrichDialog(open);
            if (!open) { setEnrichItemId(null); setEnrichError(null); }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("leadEnrichment.confirmTitle")}</DialogTitle>
              <DialogDescription>{t("leadEnrichment.confirmMessage")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("leadEnrichment.costNote", { cost: creditsPerEnrichment })}
              </p>
              {enrichError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {enrichError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEnrichDialog(false)} disabled={isEnriching}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleEnrich} disabled={isEnriching}>
                {isEnriching ? t("leadEnrichment.running") : t("leadEnrichment.title")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog
          open={showExportDialog}
          onOpenChange={(open) => {
            setShowExportDialog(open);
            if (!open) { setExportFormat("csv"); setExportNote(""); setExportError(null); }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("exports.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("exports.dialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("exports.format")}</label>
                <Select
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as "csv" | "xlsx")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">{t("exports.csv")}</SelectItem>
                    <SelectItem value="xlsx">{t("exports.excel")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("exports.noteOptional")}</label>
                <Textarea
                  placeholder={t("exports.note")}
                  value={exportNote}
                  onChange={(e) => setExportNote(e.target.value)}
                  rows={3}
                />
              </div>
              {exportError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {exportError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)} disabled={isExporting}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? t("exports.creating") : t("exports.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
