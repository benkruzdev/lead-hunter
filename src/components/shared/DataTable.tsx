import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Column definition for DataTable.
 *
 * T is the row data type.
 * - `key`: unique column identifier (used as React key)
 * - `header`: column header label
 * - `render`: optional render function; if omitted, renders `row[key]` as a string
 * - `className`: optional class for the <td> cell
 * - `headerClassName`: optional class for the <th> header cell
 */
export interface ColumnDef<T = Record<string, unknown>> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Row data */
  data: T[];
  /** Key extractor — defaults to (row, index) => index */
  getRowKey?: (row: T, index: number) => string | number;
  /** Show loading state */
  isLoading?: boolean;
  /** Rendered when data is empty and not loading */
  emptyState?: React.ReactNode;
  /** Slot above the table (search, filters, etc.) */
  toolbar?: React.ReactNode;
  /** Slot below the table (pagination, stats, etc.) */
  footer?: React.ReactNode;
  /** Optional row click handler */
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * DataTable — lightweight presentation abstraction over the existing ui/table primitives.
 *
 * This is NOT a data grid. No sorting, filtering, or state management here.
 * It only standardises structure, visual density, loading state, and empty state
 * so pages don't each define their own raw <table> boilerplate.
 *
 * Sorting / filtering logic stays in the caller page as before.
 */
export function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  emptyState,
  toolbar,
  footer,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const rowKey = getRowKey ?? ((_row: T, i: number) => i);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar slot */}
      {toolbar && <div>{toolbar}</div>}

      {/* Table wrapper */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 && emptyState ? (
          <div className="py-4">{emptyState}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "h-10 text-xs font-semibold text-muted-foreground uppercase tracking-wide",
                        col.headerClassName
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, rowIndex) => (
                  <TableRow
                    key={rowKey(row, rowIndex)}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 transition-colors"
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn("py-3 text-sm", col.className)}
                      >
                        {col.render
                          ? col.render(row, rowIndex)
                          : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Footer slot */}
      {footer && <div>{footer}</div>}
    </div>
  );
}
