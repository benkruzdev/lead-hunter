import { useState, useEffect } from "react";
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
import { Plus, List, Calendar, ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { getLeadLists, createLeadList, renameLeadList, deleteLeadList, LeadList } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { getListMeta, ListMeta } from "@/lib/listMeta";
import { Badge } from "@/components/ui/badge";

export default function LeadLists() {
  const { t } = useTranslation();
  const [lists, setLists] = useState<LeadList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listMetadata, setListMetadata] = useState<Map<string, ListMeta>>(new Map());

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
      lists.forEach(list => {
        metadata.set(list.id, getListMeta(list.id));
      });
      setListMetadata(metadata);
    } catch (error) {
      console.error('[LeadLists] Failed to load lists:', error);
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
      console.error('[LeadLists] Failed to create list:', error);
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
      console.error('[LeadLists] Failed to rename list:', error);
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
      console.error('[LeadLists] Failed to delete list:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Lead Listelerim</h2>
          <p className="text-sm text-muted-foreground">
            {t('leadListsPage.description')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" />
          {t('leadListsPage.createButton')}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {lists.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="group bg-card rounded-xl border shadow-soft p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                      <List className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                    </div>
                    {/* Action buttons */}
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
                        title="Yeniden adlandır"
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
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-2">{list.name}</h3>

                  {/* Tag Badge */}
                  {listMetadata.get(list.id)?.tag && (
                    <div className="mb-3">
                      <Badge
                        variant={
                          listMetadata.get(list.id)?.tag === 'hot' ? 'destructive' :
                            listMetadata.get(list.id)?.tag === 'followup' ? 'default' :
                              'secondary'
                        }
                      >
                        {listMetadata.get(list.id)?.tag === 'hot' && t('listMeta.tagHot')}
                        {listMetadata.get(list.id)?.tag === 'cold' && t('listMeta.tagCold')}
                        {listMetadata.get(list.id)?.tag === 'followup' && t('listMeta.tagFollowup')}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-foreground">{list.lead_count || 0}</span>
                      lead
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(list.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  </div>

                  <Link to={`/app/lists/${list.id}`}>
                    <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                      {t('leadListsPage.openButton')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <List className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Henüz Liste Yok</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                İlk lead listenizi oluşturmak için arama yapın ve işletmeleri ekleyin.
              </p>
              <Link to="/app/search">
                <Button>Arama Yap</Button>
              </Link>
            </div>
          )}
        </>
      )}

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) setNewListName(""); }}>
        <DialogContent>
          <form onSubmit={handleCreateList}>
            <DialogHeader>
              <DialogTitle>Yeni Liste Oluştur</DialogTitle>
              <DialogDescription>Lead listeniz için bir isim belirleyin.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="list-name">Liste Adı</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="örn: İstanbul Restoranlar"
                className="mt-2"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); setNewListName(""); }} disabled={isCreating}>
                İptal
              </Button>
              <Button type="submit" disabled={isCreating || newListName.trim().length === 0}>
                {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" />Oluşturuluyor...</> : <><Plus className="w-4 h-4" />Oluştur</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameValue(""); } }}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Listeyi Yeniden Adlandır</DialogTitle>
              <DialogDescription>Yeni liste adını girin.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-input">Yeni Ad</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setRenameTarget(null); setRenameValue(""); }} disabled={isRenaming}>
                İptal
              </Button>
              <Button type="submit" disabled={isRenaming || !renameValue.trim() || renameValue.trim() === renameTarget?.name}>
                {isRenaming ? <><Loader2 className="w-4 h-4 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listeyi Sil</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> listesini silmek istediğinizden emin misiniz?
              İçindeki {deleteTarget?.lead_count || 0} lead de silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" />Siliniyor...</> : <><Trash2 className="w-4 h-4" />Sil</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
