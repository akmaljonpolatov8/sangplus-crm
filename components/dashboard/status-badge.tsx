import { cn } from "@/lib-frontend/utils"

type StatusType = 
  | "active" 
  | "inactive" 
  | "paid" 
  | "unpaid" 
  | "partial" 
  | "overdue"
  | "present"
  | "absent"
  | "late"
  | "excused"

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  active: {
    label: "Faol",
    className: "bg-success/15 text-success border-success/25",
  },
  inactive: {
    label: "Nofaol",
    className: "bg-muted text-muted-foreground border-border",
  },
  paid: {
    label: "To'langan",
    className: "bg-success/15 text-success border-success/25",
  },
  unpaid: {
    label: "To'lanmagan",
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
  partial: {
    label: "Qisman",
    className: "bg-warning/15 text-warning border-warning/25",
  },
  overdue: {
    label: "Kechikkan",
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
  present: {
    label: "Keldi",
    className: "bg-success/15 text-success border-success/25",
  },
  absent: {
    label: "Kelmadi",
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
  late: {
    label: "Kechikdi",
    className: "bg-warning/15 text-warning border-warning/25",
  },
  excused: {
    label: "Sababli",
    className: "bg-chart-2/15 text-chart-2 border-chart-2/25",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
