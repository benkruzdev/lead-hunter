import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, User, Mail, Phone, CreditCard, Shield, Calendar, Search, FileDown } from "lucide-react";
import { getAdminUser } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function AdminUserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { t, i18n } = useTranslation();

    const { data: user, isLoading, error, refetch } = useQuery({
        queryKey: ['adminUser', id],
        queryFn: () => getAdminUser(id!),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-destructive">{t('admin.userDetail.loadFailed')}</p>
                <button
                    onClick={() => refetch()}
                    className="text-sm text-primary hover:underline"
                >
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-muted-foreground">{t('admin.userDetail.loadFailed')}</p>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
        return new Date(dateString).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/app/admin/users">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('admin.userDetail.backToUsers')}
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">{user.full_name}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={user.status ? "default" : "destructive"}>
                    {user.status ? t('admin.users.active') : t('admin.users.inactive')}
                </Badge>
            </div>

            {/* Profile Section */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('admin.userDetail.profile')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.fullName')}</p>
                                <p className="font-medium">{user.full_name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.email')}</p>
                                <p className="font-medium">{user.email || '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.phone')}</p>
                                <p className="font-medium">{user.phone || '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.role')}</p>
                                <p className="font-medium capitalize">{user.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.plan')}</p>
                                <Badge variant="outline">{user.plan}</Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.credits')}</p>
                                <p className="font-medium">{user.credits.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t('admin.userDetail.createdAt')}</p>
                                <p className="font-medium">{formatDate(user.created_at)}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Activity Section */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">{t('admin.userDetail.activity')}</h2>

                {/* Searches - Empty State */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            {t('admin.userDetail.searches')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8">
                            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">{t('admin.userDetail.noSearches')}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Exports - Empty State */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileDown className="w-5 h-5" />
                            {t('admin.userDetail.exports')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8">
                            <FileDown className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">{t('admin.userDetail.noExports')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
