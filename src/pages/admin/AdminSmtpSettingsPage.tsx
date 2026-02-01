import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminSmtpSettingsPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.smtpSettings.title')}</h1>
                <p className="text-muted-foreground">{t('admin.smtpSettings.description')}</p>
            </div>

            {/* SMTP Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        {t('admin.smtpSettings.smtp.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.smtpSettings.smtp.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.smtpSettings.smtp.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Test Mail */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        {t('admin.smtpSettings.testMail.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.smtpSettings.testMail.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.smtpSettings.testMail.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
