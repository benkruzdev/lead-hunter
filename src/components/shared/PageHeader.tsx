import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Primary page title */
  title: string;
  /** Optional supporting description below the title */
  description?: string;
  /** Optional small label rendered above the title (eyebrow / section label) */
  eyebrow?: string;
  /** Right-side slot — actions, buttons, controls */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader — shared page-level header for user and admin surfaces.
 *
 * Provides consistent title / description / eyebrow / actions layout.
 * Does not impose a specific page layout — pair with PageContainer.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 select-none">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-prose">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
