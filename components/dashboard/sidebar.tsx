"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UsersRound,
  ClipboardCheck,
  CreditCard,
  LogOut,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib-frontend/utils";
import {
  useRole,
  roleLabels,
  roleBadgeStyles,
  hasAccess,
} from "@/lib-frontend/role-context";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  feature: string;
};

const allNavigation: NavItem[] = [
  {
    name: "Boshqaruv paneli",
    href: "/dashboard",
    icon: LayoutDashboard,
    feature: "dashboard",
  },
  {
    name: "O'qituvchilar",
    href: "/dashboard/teachers",
    icon: Users,
    feature: "teachers",
  },
  {
    name: "O'quvchilar",
    href: "/dashboard/students",
    icon: GraduationCap,
    feature: "students",
  },
  {
    name: "Guruhlar",
    href: "/dashboard/groups",
    icon: UsersRound,
    feature: "groups",
  },
  {
    name: "Davomat",
    href: "/dashboard/attendance",
    icon: ClipboardCheck,
    feature: "attendance",
  },
  {
    name: "To'lovlar",
    href: "/dashboard/payments",
    icon: CreditCard,
    feature: "payments",
  },
];

const teacherNavigation: NavItem[] = [
  {
    name: "Davomat",
    href: "/dashboard/attendance",
    icon: ClipboardCheck,
    feature: "attendance",
  },
  {
    name: "Darsni boshlash",
    href: "/dashboard/start-lesson",
    icon: PlayCircle,
    feature: "start-lesson",
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { role, userName, isLoaded } = useRole();

  // Get navigation items based on role (only after loaded)
  const navigation = !isLoaded
    ? []
    : role === "teacher"
      ? teacherNavigation
      : allNavigation.filter((item) => hasAccess(role, item.feature));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="relative size-10 overflow-hidden rounded-xl border border-sidebar-border/60 bg-white/95">
            <Image
              src="/sangplus-logo.png.jpeg"
              alt="SangPlus logo"
              fill
              className="object-cover"
              sizes="40px"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              SangPlus
            </h1>
            <p className="text-xs text-muted-foreground">CRM</p>
          </div>
        </div>

        {/* User info with role badge */}
        <div className="border-b border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userName}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-1 text-[10px] font-medium",
                  roleBadgeStyles[role],
                )}
              >
                {roleLabels[role]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-4">
          <Link
            href="/"
            onClick={() => {
              sessionStorage.removeItem("sangplus_role");
              sessionStorage.removeItem("sangplus_username");
            }}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-5" />
            Chiqish
          </Link>
        </div>
      </div>
    </aside>
  );
}
