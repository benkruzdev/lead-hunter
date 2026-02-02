import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, Check, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DataSourceIndicatorProps {
    variant?: "compact" | "full";
    className?: string;
}

export function DataSourceIndicator({ variant = "compact", className = "" }: DataSourceIndicatorProps) {
    const { t } = useTranslation();

    if (variant === "full") {
        return (
            <div className={`flex flex-wrap items-center gap-2 ${className}`}>
                <Badge variant="outline" className="gap-1">
                    <Check className="w-3 h-3" />
                    {t('compliance.indicators.googleApis')}
                </Badge>
                <Badge variant="outline" className="gap-1">
                    <Shield className="w-3 h-3" />
                    {t('compliance.indicators.noScraping')}
                </Badge>
                <Badge variant="outline" className="gap-1">
                    <Lock className="w-3 h-3" />
                    {t('compliance.indicators.gdprCompliant')}
                </Badge>
            </div>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`inline-flex cursor-help ${className}`} tabIndex={0}>
                    <Badge variant="outline" className="gap-1">
                        <Shield className="w-3 h-3" />
                        {t('compliance.indicators.safeData')}
                    </Badge>
                </span>
            </TooltipTrigger>
            <TooltipContent className="z-50">{t('compliance.indicators.officialDataTooltip')}</TooltipContent>
        </Tooltip>
    );
}
