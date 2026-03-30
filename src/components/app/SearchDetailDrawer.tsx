import React from "react";
import { useTranslation } from "react-i18next";
import { SearchResult } from "@/lib/api";
import { CountryEntry } from "@/config/countries";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Phone, Globe, Mail, Plus, ExternalLink, Copy, Navigation, Zap } from "lucide-react";

interface SearchDetailDrawerProps {
  item: SearchResult | null;
  onClose: () => void;
  city: string;
  countryEntry?: CountryEntry;
  onAddToListClick: (item: SearchResult) => void;
  onCopyPhone: (phone: string) => void;
  copiedPhone: boolean;
}

export function SearchDetailDrawer({
  item,
  onClose,
  city,
  countryEntry,
  onAddToListClick,
  onCopyPhone,
  copiedPhone
}: SearchDetailDrawerProps) {
  const { t } = useTranslation();

  if (!item) return null;

  const handleOpenMap = () => {
    const query = encodeURIComponent(`${item.name} ${item.district || ""} ${city || ""}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <SheetContent className="sm:max-w-md overflow-y-auto w-full border-l border-muted p-0">
        <div className="animate-slide-in-right h-full flex flex-col bg-background">
          <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-8">
            <SheetHeader className="text-left space-y-3">
              <SheetTitle className="text-xl leading-snug font-bold">
                {item.name}
              </SheetTitle>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wide">
                  {item.category}
                </span>
                {(item.rating ?? 0) > 0 && (
                   <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 text-yellow-700 rounded-full text-xs font-semibold">
                     <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                     {item.rating}
                   </span>
                )}
              </div>
            </SheetHeader>

            {/* Quality / Location */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                <MapPin className="w-4 h-4" />
                {t("searchPage.drawerGeneral", "General & Location")}
              </h4>
              <div className="space-y-4 bg-muted/30 p-4 rounded-xl border shadow-sm">
                <div className="flex items-center justify-between">
                   <span className="text-sm text-muted-foreground">{t("searchPage.reviewsLabel", "Reviews")}:</span>
                   <span className="text-sm font-semibold">{item.reviews ? item.reviews.toLocaleString() : "—"}</span>
                </div>
                <div className="border-t border-dashed" />
                <div className="space-y-1">
                   <span className="text-sm text-muted-foreground">{t("searchPage.address", "Address")}:</span>
                   <p className="text-sm font-medium leading-relaxed text-foreground">
                      {item.address ||
                        [item.district, city].filter(Boolean).join(", ") ||
                        t("searchPage.noLocationInfo", "No known address")}
                   </p>
                   {countryEntry?.name && (
                     <p className="text-xs text-muted-foreground/80 mt-1">
                       {countryEntry.name}
                     </p>
                   )}
                </div>
              </div>
            </section>

            {/* Contact Details */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                 <Phone className="w-4 h-4" />
                 {t("searchPage.drawerContact", "Contact Methods")}
              </h4>
              <div className="space-y-4 bg-muted/30 p-4 rounded-xl border shadow-sm">
                <div className="space-y-1">
                   <span className="text-sm text-muted-foreground mb-1 block">{t("searchPage.phone", "Phone Number")}</span>
                   {item.phone ? (
                     <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{item.phone}</span>
                        <Button variant="outline" size="sm" onClick={() => onCopyPhone(item.phone!)} className="h-7 text-xs">
                          <Copy className="w-3 h-3 mr-1.5" />
                          {copiedPhone ? t("searchPage.copied", "Copied") : t("searchPage.copyPhone", "Copy")}
                        </Button>
                     </div>
                   ) : (
                     <span className="text-sm text-muted-foreground italic">{t("searchPage.noData", "No phone data")}</span>
                   )}
                </div>

                <div className="border-t border-dashed" />

                <div className="space-y-1">
                   <span className="text-sm text-muted-foreground mb-1 block">{t("searchPage.website", "Website")}</span>
                   {item.website ? (
                     <div className="flex flex-wrap flex-col gap-2">
                        <a
                          href={`https://${item.website.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all font-medium"
                        >
                          {item.website.replace(/^https?:\/\//, "")}
                        </a>
                     </div>
                   ) : (
                     <span className="text-sm text-muted-foreground italic">{t("searchPage.noData", "No website data")}</span>
                   )}
                </div>

                <div className="border-t border-dashed" />

                 <div className="space-y-1">
                   <span className="text-sm text-muted-foreground mb-1 block">{t("searchPage.emailAndSocial", "Email & Social")}</span>
                   {item.website ? (
                     <span className="inline-flex items-center text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                       <Zap className="w-3 h-3 mr-1" />
                       {t("searchPage.enrichmentAvailable", "Enrichment Available")}
                     </span>
                   ) : (
                     <span className="text-sm text-muted-foreground italic">{t("searchPage.noEnrichmentSource", "Requires Website")}</span>
                   )}
                </div>
              </div>
            </section>
            
          </div>

          {/* Fixed Footer Actions */}
          <div className="p-4 border-t bg-card/80 backdrop-blur-md pb-6">
            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                className="w-full gap-2 font-semibold shadow-sm"
                onClick={() => onAddToListClick(item)}
              >
                <Plus className="w-4 h-4" />
                {t("searchPage.addToListAction", "Select for List")}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleOpenMap}
              >
                <Navigation className="w-4 h-4" />
                {t("searchPage.openMap", "Open in Google Maps")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
