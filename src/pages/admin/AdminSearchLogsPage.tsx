import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminSearchLogsPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.searchLogs.title')}</h1>
                <p className="text-muted-foreground">{t('admin.searchLogs.description')}</p>
            </div>

            {/* Search Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        {t('admin.searchLogs.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.searchLogs.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.searchLogs.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
