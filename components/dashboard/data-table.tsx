"use client";

import { useMemo, useState } from "react";
import { Search, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib-frontend/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  addButtonLabel?: string;
  onAddClick?: () => void;
  onSearch?: (query: string) => void;
  showFilters?: boolean;
  className?: string;
}

function toSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSearchText(item)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => toSearchText(item))
      .join(" ");
  }
  return "";
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = "Qidirish...",
  addButtonLabel,
  onAddClick,
  onSearch,
  showFilters = true,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return data;

    return data.filter((item) => {
      const tableText = columns
        .map((column) => {
          const key = column.key as keyof T;
          const hasOwnKey = Object.prototype.hasOwnProperty.call(
            item as Record<string, unknown>,
            String(column.key),
          );
          return hasOwnKey ? toSearchText(item[key]) : toSearchText(item);
        })
        .join(" ")
        .toLowerCase();

      return tableText.includes(normalizedQuery);
    });
  }, [columns, data, query]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="bg-secondary/50 pl-9 border-transparent focus-visible:border-border"
              value={query}
              onChange={(e) => {
                const nextQuery = e.target.value;
                setQuery(nextQuery);
                onSearch?.(nextQuery);
              }}
            />
          </div>
          {showFilters && (
            <Button variant="outline" size="default" className="gap-2">
              <Filter className="size-4" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
          )}
        </div>

        {addButtonLabel && (
          <Button onClick={onAddClick} className="gap-2">
            <Plus className="size-4" />
            {addButtonLabel}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-secondary/30 hover:bg-secondary/30">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn("text-muted-foreground", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  Ma&apos;lumot topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id} className="border-border">
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={cn("py-4", column.className)}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
