import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { getAdminUsers, updateAdminUser } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsersPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);

    const limit = 25;

    const { data, isLoading, error } = useQuery({
        queryKey: ['adminUsers', searchQuery, page],
        queryFn: () => getAdminUsers({
            query: searchQuery || undefined,
            limit,
            offset: page * limit,
        }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => updateAdminUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            toast({ title: t('admin.users.updateSuccess') });
            setShowEditDialog(false);
            setEditingUser(null);
        },
        onError: () => {
            toast({ title: t('admin.users.updateFailed'), variant: "destructive" });
        }
    });

    const handleEditUser = (user: any) => {
        setEditingUser({
            id: user.id,
            plan: user.plan,
            credits: user.credits,
            status: user.status,
        });
        setShowEditDialog(true);
    };

    const handleSaveUser = () => {
        if (!editingUser) return;
        const creditsNum = Number(editingUser.credits);
        if (!Number.isFinite(creditsNum)) return;
        updateMutation.mutate({
            id: editingUser.id,
            data: {
                plan: editingUser.plan,
                credits: Math.trunc(creditsNum),
                status: editingUser.status,
            }
        });
    };

    const maskIP = (ip?: string) => {
        if (!ip) return '-';
        const parts = ip.split('.');
        if (parts.length !== 4) return ip;
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
    };

    const users = data?.users || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.users.title')}</h1>
                <p className="text-muted-foreground">{t('admin.users.description')}</p>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={t('admin.users.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(0);
                        }}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
                    <p className="text-destructive mb-4">{t('admin.users.loadFailed')}</p>
                    <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })}>
                        {t('common.retry')}
                    </Button>
                </div>
            ) : users.length === 0 ? (
                <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
                    <p className="text-muted-foreground">{t('admin.users.noUsers')}</p>
                </div>
            ) : (
                <>
                    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-3 text-left text-sm font-medium">{t('admin.users.profile')}</th>
                                        <th className="p-3 text-left text-sm font-medium">{t('admin.users.plan')}</th>
                                        <th className="p-3 text-left text-sm font-medium">{t('admin.users.credits')}</th>
                                        <th className="p-3 text-left text-sm font-medium">{t('admin.users.status')}</th>
                                        <th className="p-3 text-left text-sm font-medium">{t('admin.users.lastIP')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium">{user.full_name}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email || '-'}</p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditUser(user)}
                                                    >
                                                        {t('common.edit')}
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="outline">{user.plan}</Badge>
                                            </td>
                                            <td className="p-3">
                                                <span className="text-sm font-medium">{user.credits.toLocaleString()}</span>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={user.status ? "default" : "destructive"}>
                                                    {user.status ? t('admin.users.active') : t('admin.users.inactive')}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {maskIP(user.last_login_ip)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {t('admin.users.showing', { start: page * limit + 1, end: Math.min((page + 1) * limit, total), total })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                >
                                    {t('common.back')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                >
                                    {t('common.next')}
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={(open) => {
                setShowEditDialog(open);
                if (!open) setEditingUser(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
                        <DialogDescription>{t('admin.users.editUserDesc')}</DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('admin.users.plan')}</label>
                                <Select
                                    value={editingUser.plan}
                                    onValueChange={(value) => setEditingUser({ ...editingUser, plan: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solo">Solo</SelectItem>
                                        <SelectItem value="team">Team</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('admin.users.credits')}</label>
                                <Input
                                    type="number"
                                    value={editingUser.credits}
                                    onChange={(e) => setEditingUser({ ...editingUser, credits: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('admin.users.status')}</label>
                                <Select
                                    value={editingUser.status ? 'active' : 'inactive'}
                                    onValueChange={(value) => setEditingUser({ ...editingUser, status: value === 'active' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">{t('admin.users.active')}</SelectItem>
                                        <SelectItem value="inactive">{t('admin.users.inactive')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updateMutation.isPending}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSaveUser} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
