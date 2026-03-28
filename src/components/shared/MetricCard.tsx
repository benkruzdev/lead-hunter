import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic color schemes for MetricCard icons and accents.
 * Backed by CSS custom properties — no hardcoded palette classes.
 */
export type MetricColorScheme =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "info";

interface MetricCardProps {
  /** Short label above the value */
  label: string;
  /** Primary metric value to display prominently */
  value: string | number;
  /** Optional Lucide-compatible icon component */
  icon?: React.ElementType;
  /** Semantic color role for the icon container */
  colorScheme?: MetricColorScheme;
  /** Optional line of supporting text below the value */
  description?: string;
  /** Optional helper/trend text rendered below the description */
  helperText?: string;
  /** Render value larger for primary emphasis metrics */
  emphasis?: boolean;
  className?: string;
}

// Maps colorScheme → semantic Tailwind classes using the new status tokens
const schemeClasses: Record<
  MetricColorScheme,
  { icon: string; iconWrapper: string }
> = {
  default: {
    iconWrapper: "bg-status-neutral-subtle",
    icon: "text-status-neutral-fg",
  },
  accent: {
    iconWrapper: "bg-status-accent-subtle",
    icon: "text-status-accent-fg",
  },
  success: {
    iconWrapper: "bg-status-success-subtle",
    icon: "text-status-success-fg",
  },
  warning: {
    iconWrapper: "bg-status-warning-subtle",
    icon: "text-status-warning-fg",
  },
  info: {
    iconWrapper: "bg-status-info-subtle",
    icon: "text-status-info-fg",
  },
};

/**
 * MetricCard — shared metric/stat card for dashboards, billing, and admin pages.
 *
 * Design goal: subtle, premium, strong typography, clean spacing.
 * Uses semantic color tokens — no hardcoded palette classes.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  colorScheme = "default",
  description,
  helperText,
  emphasis = false,
  className,
}: MetricCardProps) {
  const scheme = schemeClasses[colorScheme];

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 flex flex-col gap-3",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            scheme.iconWrapper
          )}
        >
          <Icon className={cn("w-4 h-4", scheme.icon)} />
        </div>
      )}

      <div className="space-y-0.5">
        <div
          className={cn(
            "font-bold leading-none tabular-nums",
            emphasis ? "text-3xl" : "text-2xl"
          )}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground leading-tight">
          {label}
        </div>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground leading-tight -mt-1">
          {description}
        </p>
      )}

      {helperText && (
        <p className="text-xs text-muted-foreground/70 leading-tight -mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
