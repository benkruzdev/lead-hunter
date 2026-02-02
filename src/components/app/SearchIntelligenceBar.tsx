import { useTranslation } from "react-i18next";
import { Database, Coins, Clock } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchIntelligenceBarProps {
    cost?: number;
    className?: string;
}

export function SearchIntelligenceBar({ cost = 0, className = "" }: SearchIntelligenceBarProps) {
    const { t } = useTranslation();

    return (
        <div className={`flex items-center gap-4 text-xs text-muted-foreground ${className}`}>
            {/* Cache Status */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        <span>{t('searchPage.intelligence.cacheLabel')}: {t('searchPage.intelligence.cacheUnknown')}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {t('searchPage.intelligence.cacheTooltip')}
                </TooltipContent>
            </Tooltip>

            {/* Estimated Cost */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{t('searchPage.intelligence.costLabel')}: {t('searchPage.intelligence.costValue', { cost })}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {t('searchPage.intelligence.costTooltip')}
                </TooltipContent>
            </Tooltip>

            {/* Freshness */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('searchPage.intelligence.freshnessLabel')}: {t('searchPage.intelligence.freshnessUnknown')}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {t('searchPage.intelligence.freshnessTooltip')}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
