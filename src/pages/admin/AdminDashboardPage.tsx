import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDashboard } from "@/lib/api";
import { Loader2, Users, Search, Coins, FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminDashboardPage() {
    const { t } = useTranslation();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['adminDashboard'],
        queryFn: getAdminDashboard,
        refetchInterval: 30000, // Auto-refresh every 30 seconds
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
                <p className="text-destructive">{t('admin.dashboard.loadFailed')}</p>
                <button
                    onClick={() => refetch()}
                    className="text-sm text-primary hover:underline"
                >
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    const stats = [
        {
            title: t('admin.dashboard.totalUsers'),
            value: data?.total_users || 0,
            icon: Users,
            description: t('admin.dashboard.totalUsersDesc'),
        },
        {
            title: t('admin.dashboard.dailySearches'),
            value: data?.daily_search_count || 0,
            icon: Search,
            description: t('admin.dashboard.dailySearchesDesc'),
        },
        {
            title: t('admin.dashboard.dailyCredits'),
            value: data?.daily_credits_spent || 0,
            icon: Coins,
            description: t('admin.dashboard.dailyCreditsDesc'),
        },
        {
            title: t('admin.dashboard.dailyExports'),
            value: data?.daily_exports_count || 0,
            icon: FileDown,
            description: t('admin.dashboard.dailyExportsDesc'),
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.dashboard.title')}</h1>
                <p className="text-muted-foreground">{t('admin.dashboard.description')}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
