# Onboarding Tour Integration - Final Diff

## File 1: api/src/routes/auth.js

```diff
@@ -49,11 +49,15 @@
 /**
  * Update user's profile
  * PATCH /api/auth/profile
- * Body: { full_name?, phone? }
+ * Body: { full_name?, phone?, onboarding_completed? }
  */
 router.patch('/profile', requireAuth, async (req, res) => {
     try {
-        const { full_name, phone } = req.body;
+        const { full_name, phone, onboarding_completed } = req.body;

         const updates = {};
         if (full_name !== undefined) updates.full_name = full_name;
         if (phone !== undefined) updates.phone = phone;
+        
+        // Handle onboarding completion (can only be set to true, not reverted)
+        if (onboarding_completed === true) {
+            updates.onboarding_completed = true;
+        }

         if (Object.keys(updates).length === 0) {
```

**Why**: Allows backend to save onboarding_completed when tour is finished. Only accepts `true` (no reverting).

---

## File 2: src/contexts/AuthContext.tsx

**No changes needed** - `refreshProfile()` already exists at line 168.

---

## File 3: src/pages/app/SearchPage.tsx

```diff
@@ -1,4 +1,6 @@
 import { useState } from "react";
+import { useAuth } from "@/contexts/AuthContext";
+import OnboardingTour from "@/components/onboarding/OnboardingTour";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
@@ -135,6 +137,8 @@ const mockResults = [
 ];

 export default function SearchPage() {
+  const { profile } = useAuth();
+  const [showOnboarding, setShowOnboarding] = useState(false);
   const [city, setCity] = useState("");
+  const [district, setDistrict] = useState("");
   const [category, setCategory] = useState("");
   const [minRating, setMinRating] = useState([0]);
@@ -144,6 +148,15 @@ export default function SearchPage() {
   const [selectedIds, setSelectedIds] = useState<number[]>([]);
   const [detailItem, setDetailItem] = useState<(typeof mockResults)[0] | null>(null);

+  // Show onboarding tour for first-time users
+  useEffect(() => {
+    if (profile && profile.onboarding_completed === false) {
+      setShowOnboarding(true);
+    }
+  }, [profile]);
+
+  const handleOnboardingComplete = () => {
+    setShowOnboarding(false);
+  };

   const handleSearch = () => {
     setIsSearching(true);
@@ -177,11 +190,12 @@ export default function SearchPage() {
             <Label className="flex items-center gap-2">
               <MapPin className="w-4 h-4 text-muted-foreground" />
               Şehir
             </Label>
             <Select value={city} onValueChange={setCity}>
-              <SelectTrigger>
+              <SelectTrigger data-onboarding="city-select">
                 <SelectValue placeholder="Şehir seçin" />
               </SelectTrigger>
               <SelectContent>
@@ -193,11 +207,30 @@ export default function SearchPage() {
             </Select>
           </div>

+          <div className="space-y-2">
+            <Label className="flex items-center gap-2">
+              <MapPin className="w-4 h-4 text-muted-foreground" />
+              İlçe
+            </Label>
+            <Select value={district} onValueChange={setDistrict} disabled={!city}>
+              <SelectTrigger data-onboarding="district-select">
+                <SelectValue placeholder="İlçe seçin" />
+              </SelectTrigger>
+              <SelectContent>
+                {city && ["Kadıköy", "Beşiktaş", "Şişli", "Fatih"].map((d) => (
+                  <SelectItem key={d} value={d}>
+                    {d}
+                  </SelectItem>
+                ))}
+              </SelectContent>
+            </Select>
+          </div>
+
           <div className="space-y-2">
             <Label className="flex items-center gap-2">
               <Tag className="w-4 h-4 text-muted-foreground" />
               Kategori
             </Label>
-            <Select value={category} onValueChange={setCategory}>
+            <Input
+              data-onboarding="category-input"
+              type="text"
+              placeholder="ör. Restoran, Kafe"
+              value={category}
+              onChange={(e) => setCategory(e.target.value)}
+            />
-            <Select value={category} onValueChange={setCategory}>
-              <SelectTrigger>
-                <SelectValue placeholder="Kategori seçin" />
-              </SelectTrigger>
-              <SelectContent>
-                {categories.map((c) => (
-                  <SelectItem key={c} value={c}>
-                    {c}
-                  </SelectItem>
-                ))}
-              </SelectContent>
-            </Select>
           </div>

           <div className="space-y-2">
@@ -240,6 +273,7 @@ export default function SearchPage() {
           <div className="flex items-end">
             <Button
+              data-onboarding="search-button"
               onClick={handleSearch}
               className="w-full"
               disabled={!city || !category || isSearching}
@@ -303,8 +337,17 @@ export default function SearchPage() {
               </Tooltip>
               <Button
+                data-onboarding="add-to-list"
                 disabled={selectedIds.length === 0}
                 onClick={() => {
                   alert(`${selectedIds.length} lead listenize eklendi!`);
                   setSelectedIds([]);
                 }}
               >
                 <Plus className="w-4 h-4" />
                 Seçilenleri Ekle ({selectedIds.length})
               </Button>
+              <Button
+                data-onboarding="export-csv"
+                variant="outline"
+                disabled={selectedIds.length === 0}
+                onClick={() => {
+                  alert(`${selectedIds.length} lead CSV olarak indiriliyor...`);
+                }}
+              >
+                <FileDown className="w-4 h-4" />
+                CSV İndir ({selectedIds.length})
+              </Button>
             </div>
           </div>

@@ -494,6 +537,11 @@ export default function SearchPage() {
           )}
         </SheetContent>
       </Sheet>
+
+      {/* Onboarding Tour */}
+      {showOnboarding && profile && !profile.onboarding_completed && (
+        <OnboardingTour onComplete={handleOnboardingComplete} />
+      )}
     </div>
   );
 }
```

**Why**: Integrates 6-step onboarding tour with proper data-onboarding attributes, adds district select, changes category to input (per spec), adds CSV export button for step 6, and conditionally shows tour only for first-time users.

---

## Summary

**Files Changed**: 2
1. `api/src/routes/auth.js` - Backend saves `onboarding_completed` to database
2. `src/pages/app/SearchPage.tsx` - Mounts OnboardingTour with all 6 target elements

**AuthContext**: Already has `refreshProfile()` - no changes needed.

**ConfigContext**: No changes - localhost fallback not re-added, admin panel config intact.

**All 6 Steps**:
1. ✅ Şehir - `data-onboarding="city-select"`
2. ✅ İlçe - `data-onboarding="district-select"`
3. ✅ Kategori - `data-onboarding="category-input"` (changed to Input per spec)
4. ✅ Ara - `data-onboarding="search-button"`
5. ✅ Listeye Ekle - `data-onboarding="add-to-list"`
6. ✅ CSV İndir - `data-onboarding="export-csv"` (new button added to SearchPage)
