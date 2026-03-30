import React from "react";
import { useTranslation } from "react-i18next";
import { SearchResult } from "@/lib/api";
import { DataTable, ColumnDef } from "@/components/shared/DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Star, MapPin, Eye, MousePointerClick, Info, Mail, Phone, ExternalLink, Link as LinkIcon, Check, Plus, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Hardcoded logic imported from parent or extracted natively
type ContactStatus = "none" | "website_only" | "phone_only" | "full";
type EnrichmentPotential = "none" | "low" | "high";
type LeadLevel = "high" | "mid" | "low";

const contactStatusConfig: Record<ContactStatus, { labelKey: string; className: string }> = {
  none:         { labelKey: "searchPage.contactNone", className: "bg-red-50 text-red-700 border-red-200" },
  website_only: { labelKey: "searchPage.contactWeb",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  phone_only:   { labelKey: "searchPage.contactPhone",className: "bg-blue-50 text-blue-700 border-blue-200" },
  full:         { labelKey: "searchPage.contactFull", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const enrichmentPotentialConfig: Record<EnrichmentPotential, { labelKey: string; className: string }> = {
  none: { labelKey: "searchPage.enrichNone", className: "bg-gray-100 text-gray-500 border-gray-200" },
  low:  { labelKey: "searchPage.enrichLow",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { labelKey: "searchPage.enrichHigh", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const leadLevelConfig: Record<LeadLevel, { labelKey: string; className: string }> = {
  high: { labelKey: "searchPage.leadHigh", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  mid:  { labelKey: "searchPage.leadMid",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  low:  { labelKey: "searchPage.leadLow",  className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function getContactStatus(item: SearchResult): ContactStatus {
  if (item.phone && item.website) return "full";
  if (item.phone) return "phone_only";
  if (item.website) return "website_only";
  return "none";
}

function getEnrichmentPotential(item: SearchResult): EnrichmentPotential {
  if (!item.website && !item.name) return "none";
  if (!item.website) return "low";
  return "high";
}

function computeLeadScore(item: SearchResult): number {
  let score = 0;
  if ((item.reviews || 0) > 100) score += 30;
  else if ((item.reviews || 0) > 10) score += 15;
  if ((item.rating || 0) >= 4.0) score += 20;
  if (item.website) score += 25;
  if (item.phone) score += 25;
  return Math.min(score, 100);
}

function getLeadLevel(score: number): LeadLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function formatLocation(district: string | null | undefined, city: string | null | undefined, countryName?: string): string {
  const d = district?.trim();
  const c = city?.trim();
  const locs = [d, c, countryName].filter(Boolean);
  return locs.join(", ") || "—";
}

export interface SearchResultsTableProps {
  results: SearchResult[];
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  onOpenDetail: (item: SearchResult) => void;
  onAddToList: () => void;
  
  city: string;
  countryName?: string;
  
  // Footer load more
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  viewedPages: Set<number>;
  nextPage: number;
  maxCreditsPerBatch: number;
}

export function SearchResultsTable({
  results,
  selectedIds, toggleSelect, toggleSelectAll,
  onOpenDetail, onAddToList,
  city, countryName,
  hasMore, isLoadingMore, onLoadMore, viewedPages, nextPage, maxCreditsPerBatch
}: SearchResultsTableProps) {
  const { t } = useTranslation();

  const isAllSelected = selectedIds.length === results.length && results.length > 0;

  // Render Action Toolbar above the table
  const ActionToolbar = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b bg-muted/10 rounded-t-xl">
      <div className="flex items-center gap-3 flex-wrap">
         <span className="text-sm font-semibold text-foreground">
           {t("searchPage.loadedCount", { count: results.length })}
         </span>
         {selectedIds.length > 0 && (
           <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5">
             <Check className="w-3 h-3" />
             {t("searchPage.selectedPill", { count: selectedIds.length })}
           </span>
         )}
      </div>
      <Button
        data-onboarding="add-to-list"
        disabled={selectedIds.length === 0}
        size="sm"
        variant={selectedIds.length > 0 ? "default" : "outline"}
        onClick={onAddToList}
        className="gap-1.5 shrink-0"
      >
        <Plus className="w-4 h-4" />
        {t("searchPage.addToList")}
        {selectedIds.length > 0 && (
          <span className="ml-0.5 opacity-80">({selectedIds.length})</span>
        )}
      </Button>
    </div>
  );

  const LoadMoreFooter = hasMore ? (
    <div className="flex flex-col items-center gap-2 p-6 border-t bg-muted/5 rounded-b-xl">
       <Button
         variant="outline"
         size="sm"
         disabled={isLoadingMore}
         onClick={onLoadMore}
         className="gap-2 px-6 shadow-sm bg-background"
       >
         {isLoadingMore ? (
           <>
             <Loader2 className="w-4 h-4 animate-spin" />
             {t("searchPage.loading", "Loading...")}
           </>
         ) : viewedPages.has(nextPage) ? (
           <>
             <ChevronDown className="w-4 h-4" />
             {t("searchPage.loadMoreFree", "Load More (Free)")}
           </>
         ) : (
           <>
             <ChevronDown className="w-4 h-4" />
             {t("searchPage.loadMoreCta", { cost: maxCreditsPerBatch })}
           </>
         )}
       </Button>
       {!viewedPages.has(nextPage) && !isLoadingMore && (
         <p className="text-[11px] text-muted-foreground/70 text-center max-w-sm leading-relaxed mt-1">
           {t("searchPage.loadMoreFairness", "Only successfully added new business records are strictly charged against your balance.")}
         </p>
       )}
    </div>
  ) : null;

  const columns: ColumnDef<SearchResult>[] = [
    {
      key: "selection",
      header: (
        <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
      ),
      className: "w-10 px-4",
      render: (row) => (
        <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
      )
    },
    {
      key: "business",
      header: t("searchPage.colBusiness", "Business"),
      className: "min-w-[180px]",
      render: (row) => (
        <div className="font-semibold text-sm leading-snug text-foreground">{row.name}</div>
      )
    },
    {
      key: "location",
      header: t("searchPage.colLocation", "Location"),
      className: "max-w-[160px]",
      render: (row) => {
        const locLabel = formatLocation(row.district, city, countryName);
        return (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
               <TooltipTrigger asChild>
                  <span className="block truncate text-sm text-muted-foreground leading-snug">{locLabel}</span>
               </TooltipTrigger>
               <TooltipContent className="text-xs">{locLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: "category",
      header: t("searchPage.colCategory", "Category"),
      className: "max-w-[140px]",
      render: (row) => (
        <Badge variant="outline" className="font-normal text-xs bg-muted/50 border-muted-foreground/20 truncate block" title={row.category}>
          {row.category}
        </Badge>
      )
    },
    {
      key: "rating",
      header: t("searchPage.colRating", "Rating"),
      render: (row) => (
        <div className="flex items-center gap-1.5">
           <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
           <span className="text-sm font-medium">{row.rating ?? "—"}</span>
        </div>
      )
    },
    {
      key: "score",
      header: t("searchPage.colLeadScore", "Score"),
      render: (row) => {
         const score = computeLeadScore(row);
         const level = leadLevelConfig[getLeadLevel(score)];
         return (
           <TooltipProvider delayDuration={300}>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Badge variant="outline" className={`cursor-help ${level.className} font-medium`}>
                   {score}
                 </Badge>
               </TooltipTrigger>
               <TooltipContent>
                 <p>{t(level.labelKey, "Lead Quality")}</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>
         );
      }
    },
    {
      key: "contact",
      header: t("searchPage.colContact", "Contact"),
      render: (row) => {
        const contactStatus = contactStatusConfig[getContactStatus(row)];
        return (
           <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${contactStatus.className}`}>
             {t(contactStatus.labelKey, "Contact Info")}
           </span>
        );
      }
    },
    {
      key: "action",
      header: t("searchPage.colAction", "Action"),
      className: "w-24 text-right pr-4",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenDetail(row)}
          className="h-8 px-3 text-xs opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          {t("searchPage.detailBtn", "View")}
        </Button>
      )
    }
  ];

  return (
    <DataTable
       columns={columns}
       data={results}
       getRowKey={(row) => row.id}
       toolbar={ActionToolbar}
       footer={LoadMoreFooter}
       className="bg-card w-full shadow-sm rounded-xl overflow-hidden"
    />
  );
}
