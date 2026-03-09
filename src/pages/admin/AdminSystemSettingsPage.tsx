import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, Package, AlertCircle } from "lucide-react";
import { getAdminSystemSettings, updateAdminSystemSettings } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function AdminSystemSettingsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['adminSystemSettings'],
        queryFn: getAdminSystemSettings,
    });

    const [form, setForm] = useState({
        credits_per_page: '',
        credits_per_enrichment: '',
        credits_per_lead: '',
        new_user_credits: '',
    });

    // Populate form once data is fetched (runs only when data changes)
    useEffect(() => {
        if (data?.settings) {
            setForm({
                credits_per_page: String(data.settings.credits_per_page ?? ''),
                credits_per_enrichment: String(data.settings.credits_per_enrichment ?? ''),
                credits_per_lead: String(data.settings.credits_per_lead ?? ''),
                new_user_credits: String(data.settings.new_user_credits ?? ''),
            });
        }
    }, [data]);

    const mutation = useMutation({
        mutationFn: updateAdminSystemSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSystemSettings'] });
            toast({ title: "Sistem ayarları güncellendi" });
        },
        onError: (err: any) => {
            toast({ title: err.message || "Güncelleme başarısız", variant: "destructive" });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            credits_per_page: parseInt(form.credits_per_page) || 0,
            credits_per_enrichment: parseInt(form.credits_per_enrichment) || 0,
            credits_per_lead: parseInt(form.credits_per_lead) || 0,
            new_user_credits: parseInt(form.new_user_credits) || 0,
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-destructive text-center">
                    {(error as any).message || 'Sistem ayarları yüklenemedi. Admin erişimi gerekli.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.systemSettings.title')}</h1>
                <p className="text-muted-foreground">{t('admin.systemSettings.description')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Credit Rules */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            {t('admin.systemSettings.creditRules.title')}
                        </CardTitle>
                        <CardDescription>
                            Arama ve zenginleştirme işlemleri için kredi maliyetleri
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="credits_per_page">Sayfa Başı Kredi</Label>
                                <Input
                                    id="credits_per_page"
                                    type="number"
                                    min="0"
                                    value={form.credits_per_page}
                                    onChange={(e) => setForm(prev => ({ ...prev, credits_per_page: e.target.value }))}
                                    placeholder="10"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Yeni bir arama sayfası yüklendiğinde düşülen kredi
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="credits_per_enrichment">Zenginleştirme Kredisi</Label>
                                <Input
                                    id="credits_per_enrichment"
                                    type="number"
                                    min="0"
                                    value={form.credits_per_enrichment}
                                    onChange={(e) => setForm(prev => ({ ...prev, credits_per_enrichment: e.target.value }))}
                                    placeholder="1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Başarılı "Detayları Tamamla" işlemi başına kesilir
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="credits_per_lead">Listeye Lead Ekleme Kredisi</Label>
                                <Input
                                    id="credits_per_lead"
                                    type="number"
                                    min="0"
                                    value={form.credits_per_lead}
                                    onChange={(e) => setForm(prev => ({ ...prev, credits_per_lead: e.target.value }))}
                                    placeholder="1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Listeye eklenen her yeni lead başına kesilir — DB function güncellenmeli (aşağıya bakın)
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Plan Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            {t('admin.systemSettings.planSettings.title')}
                        </CardTitle>
                        <CardDescription>
                            Yeni hesaplar için varsayılan kredi miktarı
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2 max-w-xs">
                            <Label htmlFor="new_user_credits">Yeni Kullanıcı Başlangıç Kredisi</Label>
                            <Input
                                id="new_user_credits"
                                type="number"
                                min="0"
                                value={form.new_user_credits}
                                onChange={(e) => setForm(prev => ({ ...prev, new_user_credits: e.target.value }))}
                                placeholder="50"
                            />
                            <p className="text-xs text-muted-foreground">
                                Hesap açılışında otomatik tanımlanan başlangıç kredisi
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Kaydet
                </Button>
            </form>
        </div>
    );
}
