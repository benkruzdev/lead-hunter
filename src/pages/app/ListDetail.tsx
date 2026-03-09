import { useState, useEffect } from "react";
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
  ArrowLeft,
  FileDown,
  Trash2,
  Loader2,
  Tags,
  StickyNote,
  Pencil,
  Zap,
} from "lucide-react";
import { getLeadListItems, bulkUpdateListItems, bulkDeleteListItems, enrichLeadListItem, createExport, getSearchCreditCost, LeadListItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function ListDetail() {
  const { t } = useTranslation();
  const params = useParams<{ listId?: string; id?: string }>();
  const listId = (params.listId || params.id) as string | undefined;
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Bulk operations state
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkNoteDialog, setShowBulkNoteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkNoteInput, setBulkNoteInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Per-row edit state
  const [editTarget, setEditTarget] = useState<LeadListItem | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Per-row delete state
  const [deleteTarget, setDeleteTarget] = useState<LeadListItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Bulk enrich state
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [bulkEnrichProgress, setBulkEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  // Enrichment state
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [enrichItemId, setEnrichItemId] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exportNote, setExportNote] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [creditsPerEnrichment, setCreditsPerEnrichment] = useState(1);

  useEffect(() => {
    if (listId) {
      loadItems();
    } else {
      setError(t('leadLists.missingListId'));
      setIsLoading(false);
    }
    // Fetch live credit cost for enrichment dialog
    getSearchCreditCost().then(c => setCreditsPerEnrichment(c.credits_per_enrichment)).catch(() => {});
  }, [listId]);

  const loadItems = async () => {
    if (!listId) {
      setError(t('leadLists.missingListId'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getLeadListItems(listId);
      const itemsArray = Array.isArray(response)
        ? response
        : ((response as any).items ?? (response as any).leadItems ?? []);
      setItems(itemsArray);
    } catch (err: any) {
      console.error('[ListDetail] Failed to load items:', err);
      setError(err?.message || t('leadLists.loadItemsFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItemIds(checked ? items.map(item => item.id) : []);
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItemIds(prev =>
      checked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };

  const handleBulkTag = async () => {
    const tags = bulkTagInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (tags.length === 0) return;
    try {
      setIsProcessing(true);
      await bulkUpdateListItems(listId!, selectedItemIds, { tags });
      await loadItems();
      setShowBulkTagDialog(false);
      setBulkTagInput("");
      setSelectedItemIds([]);
    } catch (error) {
      console.error('[ListDetail] Bulk tag failed:', error);
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
      console.error('[ListDetail] Bulk note failed:', error);
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
      console.error('[ListDetail] Bulk delete failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      setIsSavingEdit(true);
      const tags = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      await bulkUpdateListItems(listId!, [editTarget.id], {
        note: editNote,
        tags,
      });
      await loadItems();
      setEditTarget(null);
    } catch (error) {
      console.error('[ListDetail] Edit failed:', error);
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
    } catch (error) {
      console.error('[ListDetail] Single delete failed:', error);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleBulkEnrich = async () => {
    const ids = [...selectedItemIds];
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
    // Refresh header credit balance
    refreshProfile();
  };

  const handleEnrich = async () => {
    if (!enrichItemId || !listId) return;
    try {
      setIsEnriching(true);
      setEnrichError(null);
      const result = await enrichLeadListItem(listId, enrichItemId);
      if (result.status === 'success') {
        await loadItems();
        setShowEnrichDialog(false);
        setEnrichItemId(null);
        // Refresh header credit balance
        refreshProfile();
      } else {
        setEnrichError(t('leadEnrichment.notFound'));
      }
    } catch (error: any) {
      console.error('[ListDetail] Enrichment failed:', error);
      if (error.status === 402) {
        setEnrichError(t('leadEnrichment.insufficientCredits'));
      } else {
        setEnrichError(t('leadEnrichment.failed'));
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
      setExportFormat('csv');
      setExportNote('');
    } catch (error: any) {
      console.error('[ListDetail] Export failed:', error);
      setExportError(error.message || t('exports.createFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const allSelected = items.length > 0 && selectedItemIds.length === items.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/app/lists">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Geri
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold">Liste Detayı</h2>
            <p className="text-sm text-muted-foreground">{items.length} lead</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowExportDialog(true)}>
          <FileDown className="w-4 h-4 mr-2" />
          {t('exports.create')}
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedItemIds.length > 0 && (
        <div className="bg-muted/50 border rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm font-medium">{selectedItemIds.length} öğe seçildi</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkEnrich}
              disabled={isBulkEnriching}>
              <Zap className="w-4 h-4" />
              {isBulkEnriching && bulkEnrichProgress
                ? `Tamamla (${bulkEnrichProgress.done}/${bulkEnrichProgress.total})`
                : 'Toplu Tamamla'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulkTagDialog(true)}>
              <Tags className="w-4 h-4" />
              Toplu Etiket
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulkNoteDialog(true)}>
              <StickyNote className="w-4 h-4" />
              Toplu Not
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteDialog(true)}>
              <Trash2 className="w-4 h-4" />
              Toplu Sil
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadItems}>{t('common.retry')}</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <p className="text-muted-foreground">Bu listede henüz lead yok.</p>
          <Link to="/app/search">
            <Button className="mt-4">Arama Yap</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-left">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-medium">İşletme Adı</th>
                  <th className="p-3 text-left text-sm font-medium">Telefon</th>
                  <th className="p-3 text-left text-sm font-medium">Website</th>
                  <th className="p-3 text-left text-sm font-medium">Email</th>
                  <th className="p-3 text-left text-sm font-medium">Sosyal Medya</th>
                  <th className="p-3 text-left text-sm font-medium">Not</th>
                  <th className="p-3 text-left text-sm font-medium">Etiketler</th>
                  <th className="p-3 text-left text-sm font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedItemIds.includes(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-3 text-sm font-medium">{item.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{item.phone || '-'}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {item.website ? (
                        <a
                          href={`https://${item.website.replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {item.website}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{item.email || '-'}</td>
                    <td className="p-3">
                      {item.social_links && Object.keys(item.social_links).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.social_links).map(([platform, url]) =>
                            url ? (
                              <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline capitalize">
                                {platform}
                              </a>
                            ) : null
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                      {item.note || '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditTarget(item);
                            setEditNote(item.note || '');
                            setEditTags((item.tags || []).join(', '));
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {item.enrichment_status === null || item.enrichment_status === undefined ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEnrichItemId(item.id);
                              setShowEnrichDialog(true);
                              setEnrichError(null);
                            }}
                          >
                            {t('leadEnrichment.title')}
                          </Button>
                        ) : item.enrichment_status === 'success' ? (
                          <span className="text-xs text-green-600 font-medium px-2">
                            {t('leadEnrichment.statusFound')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">
                            {t('leadEnrichment.statusNotFound')}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}
                        >
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

      {/* Per-row Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Düzenle</DialogTitle>
            <DialogDescription>{editTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Not</label>
              <Textarea
                placeholder="Not ekle..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Etiketler (virgülle ayırın)</label>
              <Input
                placeholder="örn: sıcak, takipte, potansiyel"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSavingEdit}>
              İptal
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-row Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead'i Kaldır</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> bu listeden kaldırılacak. Emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeletingSingle}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleSingleDelete} disabled={isDeletingSingle}>
              {isDeletingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" />Kaldır</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu Etiket Ekle</DialogTitle>
            <DialogDescription>
              Seçili {selectedItemIds.length} lead'e etiket ekleyin (virgülle ayırın)
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="örn: sıcak, potansiyel, takipte"
            value={bulkTagInput}
            onChange={(e) => setBulkTagInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>İptal</Button>
            <Button onClick={handleBulkTag} disabled={isProcessing || bulkTagInput.trim().length === 0}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Uygula'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Note Dialog */}
      <Dialog open={showBulkNoteDialog} onOpenChange={setShowBulkNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu Not Ekle</DialogTitle>
            <DialogDescription>Seçili {selectedItemIds.length} lead'e not ekleyin</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Not metni"
            value={bulkNoteInput}
            onChange={(e) => setBulkNoteInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkNoteDialog(false)}>İptal</Button>
            <Button onClick={handleBulkNote} disabled={isProcessing || bulkNoteInput.trim().length === 0}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Uygula'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu Sil</DialogTitle>
            <DialogDescription>
              Seçili {selectedItemIds.length} lead'i silmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrichment Dialog */}
      <Dialog open={showEnrichDialog} onOpenChange={(open) => {
        setShowEnrichDialog(open);
        if (!open) { setEnrichItemId(null); setEnrichError(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('leadEnrichment.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('leadEnrichment.confirmMessage')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('leadEnrichment.costNote', { cost: creditsPerEnrichment })}</p>
            {enrichError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">{enrichError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrichDialog(false)} disabled={isEnriching}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnrich} disabled={isEnriching}>
              {isEnriching ? t('leadEnrichment.running') : t('leadEnrichment.title')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={(open) => {
        setShowExportDialog(open);
        if (!open) { setExportFormat('csv'); setExportNote(''); setExportError(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exports.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('exports.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('exports.format')}</label>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'csv' | 'xlsx')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">{t('exports.csv')}</SelectItem>
                  <SelectItem value="xlsx">{t('exports.excel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('exports.noteOptional')}</label>
              <Textarea
                placeholder={t('exports.note')}
                value={exportNote}
                onChange={(e) => setExportNote(e.target.value)}
                rows={3}
              />
            </div>
            {exportError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">{exportError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)} disabled={isExporting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? t('exports.creating') : t('exports.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
