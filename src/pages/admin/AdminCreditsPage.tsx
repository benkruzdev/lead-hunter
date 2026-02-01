import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminCreditsPage() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t('admin.credits.title')}</h1>
                <p className="text-muted-foreground">{t('admin.credits.description')}</p>
            </div>

            {/* Credit Ledger Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        {t('admin.credits.ledger.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.credits.ledger.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.credits.ledger.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Manual Credit Load Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        {t('admin.credits.manual.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">
                            {t('admin.credits.manual.noEndpoint')}
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {t('admin.credits.manual.noEndpointDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
