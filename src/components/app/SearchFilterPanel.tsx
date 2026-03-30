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
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-5">
      
      {/* Primary fields grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Country */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
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

        {/* City */}
        <div className="space-y-1.5">
          <Label htmlFor="city-select" className="flex items-center justify-between text-xs font-semibold tracking-wide text-foreground">
             <span className="flex items-center gap-1.5">
               {t(countryEntry?.regionLabelKey ?? "searchPage.region")}
             </span>
             <span className="text-[10px] font-normal normal-case tracking-normal text-destructive">*</span>
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

        {/* District */}
        <div className="space-y-1.5">
          <Label htmlFor="district-select" className="flex items-center justify-between text-xs font-semibold tracking-wide text-foreground">
             <span className="flex items-center gap-1.5">
               {t(countryEntry?.subregionLabelKey ?? "searchPage.subregion")}
             </span>
             <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">{t("searchPage.districtOptional")}</span>
          </Label>
          {locationData ? (
            <SearchableSelect
              id="district-select"
              data-onboarding="district-select"
              value={district}
              onValueChange={setDistrict}
              options={availableDistricts}
              placeholder={!city ? t("searchPage.selectCityFirst") : t("searchPage.selectDistrict")}
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

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category-input" className="flex items-center justify-between text-xs font-semibold tracking-wide text-foreground">
             <span className="flex items-center gap-1.5">
               <Tag className="w-3.5 h-3.5 text-primary" />
               {t("searchPage.category")}
             </span>
             <span className="text-[10px] font-normal normal-case tracking-normal text-destructive">*</span>
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

      {/* Secondary fields grid */}
      <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-dashed border-border/80">
        {/* Keyword */}
        <div className="space-y-1.5">
           <Label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
             <span className="flex items-center gap-1.5">
               <Search className="w-3.5 h-3.5" />
               {t("searchPage.keyword")}
             </span>
             <span className="text-[10px] font-normal normal-case tracking-normal">{t("searchPage.districtOptional")}</span>
          </Label>
          <Input
            id="keyword-input"
            type="text"
            placeholder={t("searchPage.keywordPlaceholder")}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Rating */}
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

        {/* Reviews */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
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
            className="text-sm"
          />
        </div>
      </div>

      {/* Action footer */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
        <p className="text-[11px] text-muted-foreground order-2 sm:order-1">
          {t("searchPage.initialSearchFree")}
        </p>
        <Button
          data-onboarding="search-button"
          onClick={handleSearch}
          size="lg"
          className="w-full sm:w-auto min-w-[200px] gap-2 text-base font-semibold shadow-sm order-1 sm:order-2"
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
      </div>

    </div>
  );
}
