import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { getLeadListItems, bulkUpdateListItems, bulkDeleteListItems, LeadListItem } from "@/lib/api";

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

  useEffect(() => {
    if (listId) {
      loadItems();
    } else {
      setError(t('leadLists.missingListId'));
      setIsLoading(false);
    }
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

      // Normalize response shape
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
    if (checked) {
      setSelectedItemIds(items.map(item => item.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItemIds(prev => [...prev, itemId]);
    } else {
      setSelectedItemIds(prev => prev.filter(id => id !== itemId));
    }
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

  const allSelected = items.length > 0 && selectedItemIds.length === items.length;
  const someSelected = selectedItemIds.length > 0 && selectedItemIds.length < items.length;

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
            <p className="text-sm text-muted-foreground">
              {items.length} lead
            </p>
          </div>
        </div>
        <Button variant="outline">
          <FileDown className="w-4 h-4" />
          CSV İndir
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedItemIds.length > 0 && (
        <div className="bg-muted/50 border rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm font-medium">
            {selectedItemIds.length} öğe seçildi
          </p>
          <div className="flex items-center gap-2">
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
          <Button onClick={loadItems}>
            {t('common.retry')}
          </Button>
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
                  <th className="p-3 text-left text-sm font-medium">Skor</th>
                  <th className="p-3 text-left text-sm font-medium">Pipeline</th>
                  <th className="p-3 text-left text-sm font-medium">Not</th>
                  <th className="p-3 text-left text-sm font-medium">Etiketler</th>
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
                        <a href={`https://${item.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {item.website}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{item.email || '-'}</td>
                    <td className="p-3">
                      {item.score ? (
                        <Badge variant={item.score === 'hot' ? 'destructive' : item.score === 'warm' ? 'default' : 'secondary'}>
                          {item.score}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-sm">{item.pipeline || '-'}</td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">{item.note || '-'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
              İptal
            </Button>
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
            <DialogDescription>
              Seçili {selectedItemIds.length} lead'e not ekleyin
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Not metni"
            value={bulkNoteInput}
            onChange={(e) => setBulkNoteInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkNoteDialog(false)}>
              İptal
            </Button>
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
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
