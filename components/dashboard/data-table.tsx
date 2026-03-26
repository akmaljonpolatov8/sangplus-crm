"use client"

import { Search, Filter, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  addButtonLabel?: string
  onAddClick?: () => void
  onSearch?: (query: string) => void
  showFilters?: boolean
  className?: string
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
              onChange={(e) => onSearch?.(e.target.value)}
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
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  Ma&apos;lumot topilmadi
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
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
  )
}
