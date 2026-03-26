"use client"

import { Bell, Search, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole, roleLabels, roleBadgeStyles } from "@/lib/role-context"
import Link from "next/link"

interface DashboardHeaderProps {
  title: string
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { role, userName, isLoaded } = useRole()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search - only for owner and manager */}
        {isLoaded && (role === "owner" || role === "manager") && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              className="w-64 bg-secondary/50 pl-9 border-transparent focus-visible:border-border"
            />
          </div>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5 text-muted-foreground" />
          <span className="absolute right-1 top-1 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 px-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                {userName.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <Badge variant="outline" className={roleBadgeStyles[role]}>
                  {roleLabels[role]}
                </Badge>
              </div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mening profilim</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil sozlamalari</DropdownMenuItem>
            <DropdownMenuItem>Parolni o&apos;zgartirish</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-destructive">
              <Link 
                href="/"
                onClick={() => {
                  sessionStorage.removeItem("sangplus_role")
                  sessionStorage.removeItem("sangplus_username")
                }}
              >
                Chiqish
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
