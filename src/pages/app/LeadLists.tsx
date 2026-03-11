import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  List,
  Calendar,
  ArrowRight,
  Loader2,
  Pencil,
  Trash2,
  Search,
  LayoutList,
  Users,
  BarChart2,
  Trophy,
  X,
} from "lucide-react";
import { getLeadLists, createLeadList, renameLeadList, deleteLeadList, LeadList } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { getListMeta, ListMeta } from "@/lib/listMeta";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────
// Deterministic badge helpers (pure, no side effects)
// ─────────────────────────────────────────────

type VolumeKey = "highVolume" | "midVolume" | "smallList";
type BadgeVariant = "destructive" | "default" | "secondary" | "outline";

function getVolumeBadgeKey(leadCount: number): VolumeKey {
  if (leadCount >= 50) return "highVolume";
  if (leadCount >= 20) return "midVolume";
  return "smallList";
}

function getVolumeBadgeVariant(key: VolumeKey): BadgeVariant {
  if (key === "highVolume") return "destructive";
  if (key === "midVolume") return "default";
  return "secondary";
}

/** Returns true when the list was created within the last 7 days. */
function isRecentList(createdAt: string): boolean {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() >= sevenDaysAgo;
}

// ─────────────────────────────────────────────
// Sort helpers
// ─────────────────────────────────────────────

type SortKey = "newest" | "mostLeads" | "nameAsc";

function sortLists(lists: LeadList[], key: SortKey): LeadList[] {
  const arr = [...lists];
  if (key === "newest") {
    return arr.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  if (key === "mostLeads") {
    return arr.sort(
      (a, b) =>
        (b.lead_count || 0) - (a.lead_count || 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  // nameAsc
  return arr.sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ─────────────────────────────────────────────
// Summary stats helpers
// ─────────────────────────────────────────────

function computeSummary(lists: LeadList[]) {
  const total = lists.length;
  const totalLeads = lists.reduce((s, l) => s + (l.lead_count || 0), 0);
  const avgLeads = total > 0 ? Math.round(totalLeads / total) : 0;
  const largest = lists.reduce<LeadList | null>(
    (best, l) => (!best || (l.lead_count || 0) > (best.lead_count || 0) ? l : best),
    null
  );
  return { total, totalLeads, avgLeads, largest };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function LeadLists() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("tr") ? "tr-TR" : "en-US";

  const [lists, setLists] = useState<LeadList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listMetadata, setListMetadata] = useState<Map<string, ListMeta>>(new Map());

  // Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<LeadList | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<LeadList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      const { lists } = await getLeadLists();
      setLists(lists);

      const metadata = new Map<string, ListMeta>();
      lists.forEach((list) => {
        metadata.set(list.id, getListMeta(list.id));
      });
      setListMetadata(metadata);
    } catch (error) {
      console.error("[LeadLists] Failed to load lists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newListName.trim();
    if (trimmedName.length === 0) return;

    try {
      setIsCreating(true);
      await createLeadList(trimmedName);
      setShowCreateDialog(false);
      setNewListName("");
      await loadLists();
    } catch (error) {
      console.error("[LeadLists] Failed to create list:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    try {
      setIsRenaming(true);
      await renameLeadList(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
      setRenameValue("");
      await loadLists();
    } catch (error) {
      console.error("[LeadLists] Failed to rename list:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await deleteLeadList(deleteTarget.id);
      setDeleteTarget(null);
      await loadLists();
    } catch (error) {
      console.error("[LeadLists] Failed to delete list:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Derived state ──────────────────────────
  const summary = useMemo(() => computeSummary(lists), [lists]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = q
      ? lists.filter((l) => l.name.toLowerCase().includes(q))
      : lists;
    return sortLists(filtered, sortKey);
  }, [lists, searchQuery, sortKey]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-fade-in">

        {/* ── Header ───────────────────────────── */}
        <div className="space-y-4">
          {/* Row 1: title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t("leadListsPage.title")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("leadListsPage.description")}
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="shrink-0">
              <Plus className="w-4 h-4" />
              {t("leadListsPage.createButton")}
            </Button>
          </div>

          {/* Row 2: search + sort (only shown when not loading) */}
          {!isLoading && lists.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9 pr-9"
                  placeholder={t("leadListsPage.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSearchQuery("")}
                    aria-label={t("leadListsPage.clearSearch")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("leadListsPage.sortNewest")}</SelectItem>
                  <SelectItem value="mostLeads">{t("leadListsPage.sortMostLeads")}</SelectItem>
                  <SelectItem value="nameAsc">{t("leadListsPage.sortNameAsc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ── Loading ───────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Summary bar (only when lists exist) ── */}
            {lists.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Lists */}
                <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <LayoutList className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{t("leadListsPage.statTotalLists")}</p>
                    <p className="text-lg font-bold leading-tight">{summary.total}</p>
                  </div>
                </div>

                {/* Total Leads */}
                <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{t("leadListsPage.statTotalLeads")}</p>
                    <p className="text-lg font-bold leading-tight">{summary.totalLeads.toLocaleString(lang)}</p>
                  </div>
                </div>

                {/* Average leads per list */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-card border rounded-lg p-4 flex items-center gap-3 cursor-default">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <BarChart2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{t("leadListsPage.statAvgSize")}</p>
                        <p className="text-lg font-bold leading-tight">{summary.avgLeads.toLocaleString(lang)}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs max-w-[200px]">{t("leadListsPage.statAvgSizeTooltip")}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Largest list */}
                <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{t("leadListsPage.statLargest")}</p>
                    {summary.largest ? (
                      <p className="text-sm font-semibold leading-tight truncate" title={summary.largest.name}>
                        {summary.largest.name}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── List grid ─────────────────────── */}
            {lists.length === 0 ? (
              /* Empty: no lists at all */
              <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <List className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t("leadListsPage.emptyTitle")}</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm">
                  {t("leadListsPage.emptyDescription")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4" />
                    {t("leadListsPage.createButton")}
                  </Button>
                  <Link to="/app/search">
                    <Button variant="outline">{t("leadListsPage.goToSearch")}</Button>
                  </Link>
                </div>
              </div>
            ) : filteredAndSorted.length === 0 ? (
              /* Empty: search returned nothing */
              <div className="bg-card rounded-xl border shadow-soft p-10 text-center">
                <div className="w-14 h-14 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
                  <Search className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold mb-1">{t("leadListsPage.noResultsTitle")}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("leadListsPage.noResultsDescription", { query: searchQuery })}
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  <X className="w-3.5 h-3.5" />
                  {t("leadListsPage.clearSearch")}
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAndSorted.map((list) => {
                  const volKey = getVolumeBadgeKey(list.lead_count || 0);
                  const volVariant = getVolumeBadgeVariant(volKey);
                  const recent = isRecentList(list.created_at);
                  const tag = listMetadata.get(list.id)?.tag;

                  return (
                    <div
                      key={list.id}
                      className="group bg-card rounded-xl border shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
                    >
                      {/* Card top */}
                      <div className="p-5 flex-1 space-y-3">
                        {/* Icon row */}
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                            <List className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                          </div>
                          {/* Action buttons (hover) */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();
                                setRenameTarget(list);
                                setRenameValue(list.name);
                              }}
                              title={t("leadListsPage.renameAction")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                setDeleteTarget(list);
                              }}
                              title={t("leadListsPage.deleteAction")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold leading-snug line-clamp-2">{list.name}</h3>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-foreground text-base tabular-nums">
                            {(list.lead_count || 0).toLocaleString(lang)}
                          </span>
                          <span className="text-muted-foreground">
                            {(list.lead_count || 0) === 1
                              ? t("leadListsPage.leadSingular")
                              : t("leadListsPage.leadPlural")}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(list.created_at).toLocaleDateString(lang)}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {/* Volume badge — deterministic, with tooltip */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Badge variant={volVariant} className="text-xs cursor-default">
                                  {t(`leadListsPage.badge.${volKey}`)}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs max-w-[180px]">{t("leadListsPage.badgeVolumeTooltip")}</p>
                            </TooltipContent>
                          </Tooltip>

                          {/* "New" badge — deterministic: created within 7 days */}
                          {recent && (
                            <Badge variant="outline" className="text-xs">
                              {t("leadListsPage.badge.new")}
                            </Badge>
                          )}

                          {/* listMeta tag badge (existing behaviour, preserved) */}
                          {tag && (
                            <Badge
                              variant={
                                tag === "hot"
                                  ? "destructive"
                                  : tag === "followup"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {tag === "hot" && t("listMeta.tagHot")}
                              {tag === "cold" && t("listMeta.tagCold")}
                              {tag === "followup" && t("listMeta.tagFollowup")}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Card footer — CTA */}
                      <div className="px-5 pb-5 pt-2 border-t border-border/50">
                        <Link to={`/app/lists/${list.id}`} className="block">
                          <Button
                            variant="outline"
                            className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                          >
                            {t("leadListsPage.openButton")}
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Create List Dialog ─────────────────── */}
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) setNewListName("");
          }}
        >
          <DialogContent>
            <form onSubmit={handleCreateList}>
              <DialogHeader>
                <DialogTitle>{t("leadListsPage.dialog.createTitle")}</DialogTitle>
                <DialogDescription>{t("leadListsPage.dialog.createDesc")}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="list-name">{t("leadListsPage.dialog.listNameLabel")}</Label>
                <Input
                  id="list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder={t("leadListsPage.dialog.listNamePlaceholder")}
                  className="mt-2"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewListName("");
                  }}
                  disabled={isCreating}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || newListName.trim().length === 0}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("leadListsPage.dialog.creating")}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t("common.create")}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Rename Dialog ─────────────────────── */}
        <Dialog
          open={!!renameTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRenameTarget(null);
              setRenameValue("");
            }
          }}
        >
          <DialogContent>
            <form onSubmit={handleRename}>
              <DialogHeader>
                <DialogTitle>{t("leadListsPage.dialog.renameTitle")}</DialogTitle>
                <DialogDescription>{t("leadListsPage.dialog.renameDesc")}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="rename-input">{t("leadListsPage.dialog.newNameLabel")}</Label>
                <Input
                  id="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="mt-2"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRenameTarget(null);
                    setRenameValue("");
                  }}
                  disabled={isRenaming}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isRenaming ||
                    !renameValue.trim() ||
                    renameValue.trim() === renameTarget?.name
                  }
                >
                  {isRenaming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("leadListsPage.dialog.saving")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ─────────── */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("leadListsPage.dialog.deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("leadListsPage.dialog.deleteDesc", {
                  name: deleteTarget?.name,
                  count: deleteTarget?.lead_count || 0,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("leadListsPage.dialog.deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t("common.delete")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
