import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * StatusBadge variant options.
 *
 * Use `neutral` for generic/unknown states.
 * Use `success`, `warning`, `danger`, `info` for semantic states.
 */
export type StatusBadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

/**
 * Appearance modes.
 * - `subtle`: tinted background, darker foreground (default — less visual noise)
 * - `solid`: bold background, white foreground
 */
export type StatusBadgeAppearance = "subtle" | "solid";

const statusBadgeVariants = cva(
  // Base: inline-flex, rounded pill, consistent padding and font size
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-transparent transition-colors",
  {
    variants: {
      variant: {
        neutral: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
      },
      appearance: {
        subtle: "",
        solid: "",
      },
    },
    // compoundVariants applies colour logic for each variant+appearance combo
    compoundVariants: [
      // ── neutral ────────────────────────────────────────────────────────
      {
        variant: "neutral",
        appearance: "subtle",
        className:
          "bg-status-neutral-subtle text-status-neutral-fg border-status-neutral-subtle",
      },
      {
        variant: "neutral",
        appearance: "solid",
        className:
          "bg-status-neutral text-white border-status-neutral",
      },
      // ── success ────────────────────────────────────────────────────────
      {
        variant: "success",
        appearance: "subtle",
        className:
          "bg-status-success-subtle text-status-success-fg border-status-success-subtle",
      },
      {
        variant: "success",
        appearance: "solid",
        className:
          "bg-status-success text-white border-status-success",
      },
      // ── warning ────────────────────────────────────────────────────────
      {
        variant: "warning",
        appearance: "subtle",
        className:
          "bg-status-warning-subtle text-status-warning-fg border-status-warning-subtle",
      },
      {
        variant: "warning",
        appearance: "solid",
        className:
          "bg-status-warning text-white border-status-warning",
      },
      // ── danger ─────────────────────────────────────────────────────────
      {
        variant: "danger",
        appearance: "subtle",
        className:
          "bg-status-danger-subtle text-status-danger-fg border-status-danger-subtle",
      },
      {
        variant: "danger",
        appearance: "solid",
        className:
          "bg-status-danger text-white border-status-danger",
      },
      // ── info ───────────────────────────────────────────────────────────
      {
        variant: "info",
        appearance: "subtle",
        className:
          "bg-status-info-subtle text-status-info-fg border-status-info-subtle",
      },
      {
        variant: "info",
        appearance: "solid",
        className:
          "bg-status-info text-white border-status-info",
      },
    ],
    defaultVariants: {
      variant: "neutral",
      appearance: "subtle",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Optional leading dot indicator */
  dot?: boolean;
}

/**
 * StatusBadge — unified semantic status/state badge.
 *
 * Built on the existing Badge primitive's design language but with
 * explicit semantic variants to replace page-level inline badge patterns.
 *
 * Do not use for domain-specific labels (format badges, method badges, etc.)
 * that belong to their respective pages. Use for general state: success,
 * warning, danger, info, neutral.
 */
export function StatusBadge({
  variant,
  appearance,
  dot = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant, appearance }), className)}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
