import { useTranslation } from "react-i18next";
import { Check, X, Info, Sparkles } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface EnrichmentResultReportProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    businessName: string;
    result: {
        found: { labelKey: string; value: string }[];
        missing: { labelKey: string }[];
        credits: { cost: number; onlyOnSuccess: boolean };
    };
}

export function EnrichmentResultReport({
    open,
    onOpenChange,
    businessName,
    result,
}: EnrichmentResultReportProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        {t('enrichment.title', { name: businessName })}
                    </DialogTitle>
                    <DialogDescription>
                        {t('enrichment.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Found Section */}
                    {result.found.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                {t('enrichment.foundTitle')}
                            </h3>
                            <div className="space-y-2">
                                {result.found.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                                    >
                                        <span className="text-sm font-medium text-green-900">
                                            {t(`enrichment.labels.${item.labelKey}`)}
                                        </span>
                                        <span className="text-sm text-green-700 font-mono">
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Missing Section */}
                    {result.missing.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <X className="w-4 h-4 text-muted-foreground" />
                                {t('enrichment.missingTitle')}
                            </h3>
                            <div className="space-y-2">
                                {result.missing.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-muted/30 border border-muted rounded-lg"
                                    >
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {t(`enrichment.labels.${item.labelKey}`)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {t('enrichment.missingValue')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Credits Info */}
                    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-900">
                                {t('enrichment.creditsTitle')}
                            </p>
                            <p className="text-sm text-blue-700">
                                {t('enrichment.creditsCost', { cost: result.credits.cost })}
                            </p>
                            {result.credits.onlyOnSuccess && (
                                <p className="text-xs text-blue-600">
                                    {t('enrichment.onlyOnSuccessNote')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
