import { LucideIcon } from "lucide-react"
import { cn } from "@/lib-frontend/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
  iconClassName?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30",
        className
      )}
    >
      {/* Background glow effect */}
      <div className="absolute -right-4 -top-4 size-24 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "flex items-center text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              <span className="ml-1 text-muted-foreground">o&apos;tgan oyga nisbatan</span>
            </p>
          )}
        </div>
        
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-xl",
            iconClassName || "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  )
}
