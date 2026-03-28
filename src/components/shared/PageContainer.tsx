import * as React from "react";
import { cn } from "@/lib/utils";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface PageContainerProps {
  children: React.ReactNode;
  /**
   * Maximum width constraint for page content.
   * Defaults to "xl" (1280px) — appropriate for most app pages.
   * Use "full" to disable the constraint for wide-layout pages.
   */
  maxWidth?: MaxWidth;
  className?: string;
}

const maxWidthClasses: Record<MaxWidth, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

/**
 * PageContainer — optional page-level layout wrapper.
 *
 * Establishes consistent max-width and vertical spacing rhythm for page content.
 * Use in pilot pages to validate the layout system — not forced globally yet.
 *
 * Designed to sit inside AppLayout's <main> or AdminLayout's content area.
 */
export function PageContainer({
  children,
  maxWidth = "xl",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto space-y-6",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
