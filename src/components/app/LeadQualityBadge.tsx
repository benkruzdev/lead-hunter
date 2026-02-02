import { useTranslation } from "react-i18next";
import { Sparkles, Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeadQualityBadgeProps {
    variant: "new" | "active" | "engaged";
}

export function LeadQualityBadge({ variant }: LeadQualityBadgeProps) {
    const { t } = useTranslation();

    const config = {
        new: {
            icon: Sparkles,
            className: "bg-blue-50 text-blue-700 border-blue-200",
            label: t('leadQuality.new.label'),
            tooltip: t('leadQuality.new.tooltip'),
        },
        active: {
            icon: Activity,
            className: "bg-green-50 text-green-700 border-green-200",
            label: t('leadQuality.active.label'),
            tooltip: t('leadQuality.active.tooltip'),
        },
        engaged: {
            icon: TrendingUp,
            className: "bg-purple-50 text-purple-700 border-purple-200",
            label: t('leadQuality.engaged.label'),
            tooltip: t('leadQuality.engaged.tooltip'),
        },
    };

    const { icon: Icon, className, label, tooltip } = config[variant];

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-xs ${className}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {label}
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
}
