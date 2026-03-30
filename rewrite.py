import sys

with open(r'c:\lead-hunter\src\pages\app\SearchPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if '{/* ── Filter Panel ── */}' in line:
        start_idx = i
        break

end_idx = -1
for i in range(len(lines)-1, -1, -1):
    if '{/* ── List Selection Dialog ── */}' in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_render = """      {/* Two-Pane Workspace Layout */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        
        {/* Left Pane: Filters */}
        <div className="w-full xl:w-[340px] shrink-0">
          <SearchFilterPanel
            country={country} setCountry={setCountry}
            city={city} setCity={setCity}
            district={district} setDistrict={setDistrict} availableDistricts={availableDistricts}
            category={category} setCategory={setCategory}
            keyword={keyword} setKeyword={setKeyword}
            minRating={minRating} setMinRating={setMinRating}
            minReviews={minReviews} setMinReviews={setMinReviews}
            isSearching={isSearching} handleSearch={handleSearch}
            countryEntry={countryEntry} locationData={locationData ?? null}
          />
        </div>

        {/* Right Pane: Results Stage */}
        <div ref={resultsRef} className="flex-1 min-w-0 flex flex-col gap-4">
          
          {/* Active Session Badge (if restoring from history) */}
          {sessionId && !hasSearched && results.length === 0 && (
             <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm font-semibold text-primary">{t("searchPage.restoringSession", "Restoring active search session...")}</p>
             </div>
          )}

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
          ) : hasSearched || results.length > 0 ? (
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
               onLoadMore={doLoadMore}
               viewedPages={viewedPages}
               nextPage={nextPage}
               maxCreditsPerBatch={maxCreditsPerBatch}
             />
          ) : (
            {/* Empty State */}
            <div className="bg-card rounded-xl border border-dashed shadow-sm flex flex-col items-center justify-center py-24 px-6 text-center">
               <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                 <Search className="w-8 h-8 text-primary" />
               </div>
               <h3 className="text-xl font-semibold mb-2">{t("searchPage.emptyStateTitle", "Start Generating Leads")}</h3>
               <p className="text-muted-foreground text-sm max-w-sm mb-6">
                 {t("searchPage.emptyStateDesc", "Configure your target audience on the left carefully. Your initial search results fetch is completely free of charge.")}
               </p>
            </div>
          )}

        </div>
      </div>

      <SearchDetailDrawer
        item={detailItem}
        onClose={() => setDetailItem(null)}
        city={city}
        countryEntry={countryEntry}
        copiedPhone={copiedPhone}
        onCopyPhone={handleCopyPhone}
        onAddToListClick={(item) => {
          setSelectedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
          setDetailItem(null);
          setTimeout(() => openListDialog(), 0);
        }}
      />
"""
    new_lines = lines[:start_idx] + [new_render, '\n'] + lines[end_idx:]
    with open(r'c:\lead-hunter\src\pages\app\SearchPage.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f'Replaced {start_idx} to {end_idx} successfully')
else:
    print(f'Failed to find markers: start={start_idx}, end={end_idx}')
