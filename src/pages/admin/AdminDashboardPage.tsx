import { useQuery } from "@tanstack/react-query";
import { getAdminDashboard } from "@/lib/api";
import { Loader2, Users, Search, Coins, FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import type { MetricColorScheme } from "@/components/shared/MetricCard";

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

    const stats: Array<{
        title: string;
        value: number;
        icon: React.ElementType;
        description: string;
        colorScheme: MetricColorScheme;
    }> = [
        {
            title: t('admin.dashboard.totalUsers'),
            value: data?.total_users || 0,
            icon: Users,
            description: t('admin.dashboard.totalUsersDesc'),
            colorScheme: "accent",
        },
        {
            title: t('admin.dashboard.dailySearches'),
            value: data?.daily_search_count || 0,
            icon: Search,
            description: t('admin.dashboard.dailySearchesDesc'),
            colorScheme: "info",
        },
        {
            title: t('admin.dashboard.dailyCredits'),
            value: data?.daily_credits_spent || 0,
            icon: Coins,
            description: t('admin.dashboard.dailyCreditsDesc'),
            colorScheme: "warning",
        },
        {
            title: t('admin.dashboard.dailyExports'),
            value: data?.daily_exports_count || 0,
            icon: FileDown,
            description: t('admin.dashboard.dailyExportsDesc'),
            colorScheme: "success",
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('admin.dashboard.title')}
                description={t('admin.dashboard.description')}
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <MetricCard
                        key={stat.title}
                        label={stat.title}
                        value={stat.value.toLocaleString()}
                        icon={stat.icon}
                        colorScheme={stat.colorScheme}
                        description={stat.description}
                    />
                ))}
            </div>
        </div>
    );
}
