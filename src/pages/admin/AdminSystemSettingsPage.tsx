import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Mail, DollarSign, Package, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminSystemSettingsPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.systemSettings.title')}</h1>
                <p className="text-muted-foreground">{t('admin.systemSettings.description')}</p>
            </div>

            {/* SMTP Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        {t('admin.systemSettings.smtp.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.systemSettings.smtp.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.systemSettings.smtp.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Test Mail */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        {t('admin.systemSettings.testMail.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.systemSettings.testMail.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.systemSettings.testMail.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Credit Rules */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        {t('admin.systemSettings.creditRules.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.systemSettings.creditRules.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.systemSettings.creditRules.noEndpointDesc')}
                        </p>
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
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.systemSettings.planSettings.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.systemSettings.planSettings.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
