import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminExportsPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.exports.title')}</h1>
                <p className="text-muted-foreground">{t('admin.exports.description')}</p>
            </div>

            {/* Exports Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileDown className="w-5 h-5" />
                        {t('admin.exports.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.exports.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.exports.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
