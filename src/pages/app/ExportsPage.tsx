import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getExports, downloadExport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileDown,
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  ArrowUpDown,
  PackageOpen,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr, enUS } from "date-fns/locale";

interface Export {
  id: string;
  listId: string;
  listName: string;
  format: string;
  scope?: string;
  fileName: string;
  leadCount: number;
  note: string | null;
  createdAt: string;
}

type SortKey = "newest" | "oldest" | "mostLeads" | "listName";
type FormatFilter = "all" | "csv" | "xlsx";
type ScopeFilter = "all" | "compact" | "full";

export default function ExportsPage() {
  const { t, i18n } = useTranslation();
  const [exports, setExports] = useState<Export[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFormat, setFilterFormat] = useState<FormatFilter>("all");
  const [filterScope, setFilterScope] = useState<ScopeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getExports();
      // Normalize: backend may return camelCase or snake_case field names.
      const normalized: Export[] = (data.exports ?? []).map((raw: any) => ({
        id:        raw.id ?? "",
        listId:    raw.listId    ?? raw.list_id    ?? "",
        listName:  raw.listName  ?? raw.list_name  ?? "—",
        format:    raw.format    ?? "",
        scope:     raw.scope     ?? undefined,
        fileName:  raw.fileName  ?? raw.file_name  ?? "—",
        leadCount: raw.leadCount ?? raw.lead_count ?? 0,
        note:      raw.note      ?? null,
        createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
      }));
      setExports(normalized);
    } catch (err: any) {
      console.error("[ExportsPage] Load failed:", err);
      setError(err.message || t("exports.createFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (exportId: string) => {
    try {
      setDownloadingId(exportId);
      const { downloadUrl } = await downloadExport(exportId);
      window.location.href = downloadUrl;
    } catch (err: any) {
      console.error("[ExportsPage] Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const locale = i18n.language === "tr" ? tr : enUS;

  // ── Summary metrics ─────────────────────────────────────────
  const summary = useMemo(() => {
    const total = exports.length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = exports.filter(
      (e) => new Date(e.createdAt).getTime() >= sevenDaysAgo
    ).length;

    const formatCounts: Record<string, number> = {};
    for (const e of exports) {
      const f = (e.format || "").toLowerCase();
      formatCounts[f] = (formatCounts[f] ?? 0) + 1;
    }
    const mostUsed = Object.entries(formatCounts).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0]?.toUpperCase() ?? "—";

    const lastTime =
      exports.length > 0
        ? formatDistanceToNow(new Date(exports[0].createdAt), {
            addSuffix: true,
            locale,
          })
        : "—";

    return { total, last7, mostUsed, lastTime };
  }, [exports, locale]);

  // ── Filtered + sorted list ────────────────────────────────
  const visible = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = exports.filter((e) => {
      if (q && !(e.fileName.toLowerCase().includes(q) || e.listName.toLowerCase().includes(q))) return false;
      if (filterFormat !== "all" && e.format.toLowerCase() !== filterFormat) return false;
      if (filterScope !== "all" && (e.scope ?? "") !== filterScope) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "mostLeads": return (b.leadCount ?? 0) - (a.leadCount ?? 0);
        case "listName": return a.listName.localeCompare(b.listName);
      }
    });

    return list;
  }, [exports, searchQuery, filterFormat, filterScope, sortKey]);

  const hasActiveFilter =
    searchQuery.length > 0 || filterFormat !== "all" || filterScope !== "all";

  // ── Helpers ──────────────────────────────────────────────
  function FormatBadge({ format }: { format: string }) {
    const f = format.toLowerCase();
    if (f === "xlsx") {
      return (
        <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
          XLSX
        </Badge>
      );
    }
    return (
      <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
        CSV
      </Badge>
    );
  }

  function ScopeBadge({ scope }: { scope?: string }) {
    if (scope === "full") {
      return (
        <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">
          {t("exports.scopeFull")}
        </Badge>
      );
    }
    if (scope === "compact") {
      return (
        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          {t("exports.scopeCompact")}
        </Badge>
      );
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("exports.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("exports.emptyDescription")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadExports}
          disabled={isLoading}
          className="shrink-0 mt-1"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-1.5">{t("exports.refresh")}</span>
        </Button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadExports}>{t("common.retry")}</Button>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t("exports.totalExports"), value: summary.total },
              { label: t("exports.last7Days"), value: summary.last7 },
              { label: t("exports.mostUsedFormat"), value: summary.mostUsed },
              { label: t("exports.lastExport"), value: summary.lastTime },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-card rounded-xl border p-4 flex flex-col gap-0.5"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-lg font-semibold truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Control bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t("exports.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterFormat} onValueChange={(v) => setFilterFormat(v as FormatFilter)}>
              <SelectTrigger className="w-[130px]">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("exports.filterAll")}</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterScope} onValueChange={(v) => setFilterScope(v as ScopeFilter)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("exports.filterAll")}</SelectItem>
                <SelectItem value="full">{t("exports.scopeFull")}</SelectItem>
                <SelectItem value="compact">{t("exports.scopeCompact")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("exports.sortNewest")}</SelectItem>
                <SelectItem value="oldest">{t("exports.sortOldest")}</SelectItem>
                <SelectItem value="mostLeads">{t("exports.sortMostLeads")}</SelectItem>
                <SelectItem value="listName">{t("exports.sortListName")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empty: no exports at all */}
          {exports.length === 0 ? (
            <div className="bg-card rounded-xl border p-14 text-center">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium mb-1">{t("exports.neverExported")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("exports.emptyDescription")}
              </p>
              <Button variant="outline" asChild>
                <Link to="/app/lists">{t("exports.emptyCta")}</Link>
              </Button>
            </div>
          ) : visible.length === 0 ? (
            /* Empty: filter produced no results */
            <div className="bg-card rounded-xl border p-12 text-center">
              <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">{t("exports.emptyFilter")}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearchQuery("");
                  setFilterFormat("all");
                  setFilterScope("all");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            /* Table */
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.fileName")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.listName")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.scope")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.format")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.leadCount")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.createdAt")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.note")}</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">{t("exports.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((exp) => (
                      <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-sm font-medium max-w-[180px] truncate">
                          {exp.fileName}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[140px] truncate">
                          {exp.listName}
                        </td>
                        <td className="p-3">
                          <ScopeBadge scope={exp.scope} />
                        </td>
                        <td className="p-3">
                          <FormatBadge format={exp.format} />
                        </td>
                        <td className="p-3 text-sm tabular-nums">{exp.leadCount}</td>
                        <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(exp.createdAt), {
                            addSuffix: true,
                            locale,
                          })}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[140px]">
                          {exp.note ? (
                            <span className="truncate block">{exp.note}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(exp.id)}
                              disabled={downloadingId === exp.id}
                            >
                              {downloadingId === exp.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileDown className="w-3.5 h-3.5" />
                              )}
                              <span className="ml-1.5">
                                {downloadingId === exp.id
                                  ? t("exports.downloading")
                                  : t("exports.download")}
                              </span>
                            </Button>
                            <Button variant="ghost" size="sm" disabled title={t("exports.regenerate")}>
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" disabled title={t("exports.deleteExport")}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
