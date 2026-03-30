import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Tag, Search, Star, MessageSquare, Check, X, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRY_BY_CODE, VISIBLE_COUNTRIES, CountryEntry, LocationData } from "@/config/countries";

// ─── Searchable combobox (Popover + Command) ──────────────────────────────────
interface SearchableSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  "data-onboarding"?: string;
}

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No results",
  clearLabel = "Clear",
  disabled = false,
  id,
  ...rest
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const optionMap = new Map(options.map(o => [o.toLocaleLowerCase(), o]));
  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          {...rest}
          className={
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 " +
            "disabled:cursor-not-allowed disabled:opacity-50 transition-colors " +
            (open ? "ring-2 ring-ring ring-offset-2" : "")
          }
          onClick={() => !disabled && setOpen(o => !o)}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">{emptyText}</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  key="__clear__"
                  value="__clear__"
                  onSelect={() => { onValueChange(""); setOpen(false); }}
                  className="text-muted-foreground italic"
                >
                  <X className="mr-2 h-3.5 w-3.5 opacity-50" />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={selectedNormalized => {
                    const original = optionMap.get(selectedNormalized) ?? opt;
                    onValueChange(original === value ? "" : original);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={"mr-2 h-4 w-4 " + (value === opt ? "opacity-100" : "opacity-0")}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Country selector (Popover + Command) ────────────────────────────────────
interface CountrySelectProps {
  value: string;
  onValueChange: (code: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
}

function CountrySelect({
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No results",
  clearLabel = "Clear",
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selectedEntry = COUNTRY_BY_CODE.get(value);
  const selectedDisplay = selectedEntry ? `${selectedEntry.flag} ${selectedEntry.name}` : "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors " +
            (open ? "ring-2 ring-ring ring-offset-2" : "")
          }
          onClick={() => setOpen(o => !o)}
        >
          <span className={selectedDisplay ? "text-foreground" : "text-muted-foreground"}>
            {selectedDisplay || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">{emptyText}</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  key="__clear__"
                  value="__clear__"
                  onSelect={() => { onValueChange(""); setOpen(false); }}
                  className="text-muted-foreground italic"
                >
                  <X className="mr-2 h-3.5 w-3.5 opacity-50" />
                  {clearLabel}
                </CommandItem>
              )}
              {VISIBLE_COUNTRIES.map(entry => {
                const display = `${entry.flag} ${entry.name}`;
                return (
                  <CommandItem
                    key={entry.code}
                    value={display}
                    onSelect={() => {
                      onValueChange(entry.code === value ? "" : entry.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={"mr-2 h-4 w-4 " + (value === entry.code ? "opacity-100" : "opacity-0")}
                    />
                    <span className="flex-1">{display}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface SearchFilterPanelProps {
  country: string;
  setCountry: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  district: string;
  setDistrict: (v: string) => void;
  availableDistricts: string[];
  
  category: string;
  setCategory: (v: string) => void;
  keyword: string;
  setKeyword: (v: string) => void;
  minRating: number[];
  setMinRating: (v: number[]) => void;
  minReviews: string;
  setMinReviews: (v: string) => void;

  isSearching: boolean;
  handleSearch: () => void;
  
  countryEntry?: CountryEntry;
  locationData?: LocationData | null;
}

export function SearchFilterPanel({
  country, setCountry,
  city, setCity,
  district, setDistrict, availableDistricts,
  category, setCategory,
  keyword, setKeyword,
  minRating, setMinRating,
  minReviews, setMinReviews,
  isSearching, handleSearch,
  countryEntry, locationData
}: SearchFilterPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-6 lg:sticky lg:top-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
      
      {/* Target Geography */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
          {t("searchPage.geographicTarget", "Geography (Required)")}
        </h3>
        
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {t("searchPage.country")}
            </Label>
            <CountrySelect
              value={country}
              onValueChange={setCountry}
              placeholder={t("searchPage.selectCountry")}
              searchPlaceholder={t("searchPage.searchCountry")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city-select" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
               {t(countryEntry?.regionLabelKey ?? "searchPage.region")}
               <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-destructive">*</span>
            </Label>
            {locationData ? (
              <SearchableSelect
                id="city-select"
                data-onboarding="city-select"
                value={city}
                onValueChange={setCity}
                options={locationData?.regions ?? []}
                placeholder={t("searchPage.selectRegion")}
                searchPlaceholder={t("searchPage.searchCity")}
              />
            ) : (
               <Input
                 id="city-select"
                 placeholder={t(countryEntry?.regionLabelKey ?? "searchPage.region")}
                 value={city}
                 onChange={e => setCity(e.target.value)}
                 required
               />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="district-select" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
               {t(countryEntry?.subregionLabelKey ?? "searchPage.subregion")}
               <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground">Opt</span>
            </Label>
            {locationData ? (
              <SearchableSelect
                id="district-select"
                data-onboarding="district-select"
                value={district}
                onValueChange={setDistrict}
                options={availableDistricts}
                placeholder={!city ? "Select City First" : "Select District"}
                disabled={!city || availableDistricts.length === 0}
              />
            ) : (
                <Input
                 id="district-select"
                 placeholder={t(countryEntry?.subregionLabelKey ?? "searchPage.subregion")}
                 value={district}
                 onChange={e => setDistrict(e.target.value)}
                 disabled={!city}
               />
            )}
          </div>
        </div>
      </section>

      {/* Target Intent */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
          {t("searchPage.searchIntent", "Intent (Required)")}
        </h3>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="category-input" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <Tag className="w-3.5 h-3.5 text-primary" />
              {t("searchPage.category")}
               <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-destructive">*</span>
            </Label>
            <Input
              data-onboarding="category-input"
              id="category-input"
              type="text"
              placeholder={t("searchPage.categoryPlaceholder", "e.g. Restaurants, IT, Logistics")}
              value={category}
              onChange={e => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 pt-1">
             <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Search className="w-3.5 h-3.5" />
              {t("searchPage.keyword")}
               <span className="ml-auto text-[10px] font-normal normal-case tracking-normal">Opt</span>
            </Label>
            <Input
              id="keyword-input"
              type="text"
              placeholder={t("searchPage.keywordPlaceholder", "Optional target keyword")}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </section>

      {/* Quality Gates */}
      <section className="space-y-4">
         <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
          {t("searchPage.qualityGates", "Quality Thresholds")}
        </h3>
         <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Star className="w-3.5 h-3.5" />
              {t("searchPage.minRating")}: <span className="font-semibold text-foreground ml-1">{minRating[0].toFixed(1)}</span>
            </Label>
            <Slider
              id="min-rating-slider"
              value={minRating}
              onValueChange={setMinRating}
              min={0}
              max={5}
              step={0.1}
              className="py-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              {t("searchPage.minReviews")}
            </Label>
            <Input
              id="min-reviews-input"
              type="number"
              min="0"
              placeholder={t("searchPage.minReviewsPlaceholder", "Minimum reviews")}
              value={minReviews}
              onChange={e => {
                const value = Number(e.target.value);
                setMinReviews(value < 0 ? "0" : e.target.value);
              }}
              className="text-sm"
            />
          </div>
         </div>
      </section>

      <div className="pt-4 pt-2 border-t">
        <Button
            data-onboarding="search-button"
            onClick={handleSearch}
            size="lg"
            className="w-full gap-2 text-base font-semibold shadow-sm"
            disabled={!city || !category || isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("searchPage.searching")}
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              {t("searchPage.search")}
            </>
          )}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          {t("searchPage.initialSearchFree", "Initial page fetch is completely free.")}
        </p>
      </div>

    </div>
  );
}
