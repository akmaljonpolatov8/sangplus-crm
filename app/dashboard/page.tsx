"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useRole, hasAccess } from "@/lib-frontend/role-context";
import {
  GraduationCap,
  UsersRound,
  ClipboardCheck,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Mock data
const recentActivity = [
  {
    id: 1,
    action: "Yangi o'quvchi qo'shildi",
    name: "Aziza Karimova",
    time: "5 daqiqa oldin",
    type: "student",
  },
  {
    id: 2,
    action: "To'lov qabul qilindi",
    name: "Bobur Aliyev",
    time: "15 daqiqa oldin",
    type: "payment",
  },
  {
    id: 3,
    action: "Davomat belgilandi",
    name: "Kimyo 101 guruhi",
    time: "30 daqiqa oldin",
    type: "attendance",
  },
  {
    id: 4,
    action: "Guruh yaratildi",
    name: "Biologiya 202",
    time: "1 soat oldin",
    type: "group",
  },
];

const overduePayments = [
  {
    id: 1,
    student: "Jasur Toshmatov",
    group: "Kimyo 101",
    amount: "350,000",
    daysOverdue: 5,
  },
  {
    id: 2,
    student: "Malika Rahimova",
    group: "Biologiya 201",
    amount: "350,000",
    daysOverdue: 3,
  },
  {
    id: 3,
    student: "Sardor Umarov",
    group: "Kimyo 102",
    amount: "350,000",
    daysOverdue: 8,
  },
];

const teacherActivity = [
  {
    id: 1,
    name: "Dilshod Karimov",
    subject: "Kimyo",
    lessonsToday: 4,
    attendance: 92,
  },
  {
    id: 2,
    name: "Nilufar Saidova",
    subject: "Biologiya",
    lessonsToday: 3,
    attendance: 88,
  },
  {
    id: 3,
    name: "Ulugbek Tursunov",
    subject: "Kimyo",
    lessonsToday: 5,
    attendance: 95,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { role, isLoaded } = useRole();

  // Redirect teacher to attendance page (only after role is loaded)
  useEffect(() => {
    if (isLoaded && role === "teacher") {
      router.replace("/dashboard/attendance");
    }
  }, [role, isLoaded, router]);

  // Show loading while role is being loaded
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Don't render dashboard for teachers
  if (role === "teacher") {
    return null;
  }

  const canViewPaymentAmounts = hasAccess(role, "payments-amounts");

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Boshqaruv paneli" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Jami o'quvchilar"
            value="256"
            icon={GraduationCap}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Faol guruhlar"
            value="18"
            icon={UsersRound}
            iconClassName="bg-chart-2/10 text-chart-2"
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Bugungi davomat"
            value="89%"
            icon={ClipboardCheck}
            iconClassName="bg-chart-4/10 text-chart-4"
          />
          {role === "owner" ? (
            <StatCard
              title="Qarzdorlar soni"
              value="12"
              icon={AlertCircle}
              iconClassName="bg-destructive/10 text-destructive"
            />
          ) : (
            <StatCard
              title="O'qituvchilar"
              value="8"
              icon={Users}
              iconClassName="bg-chart-3/10 text-chart-3"
            />
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 rounded-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">
                So&apos;nggi faoliyat
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                asChild
              >
                <Link href="/dashboard/students">
                  Barchasini ko&apos;rish
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity
                  .filter((activity) => {
                    // Manager shouldn't see payment activities with amounts
                    if (role === "manager" && activity.type === "payment") {
                      return false;
                    }
                    return true;
                  })
                  .map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between rounded-xl bg-secondary/30 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          {activity.type === "student" && (
                            <GraduationCap className="size-5 text-primary" />
                          )}
                          {activity.type === "payment" && (
                            <TrendingUp className="size-5 text-success" />
                          )}
                          {activity.type === "attendance" && (
                            <ClipboardCheck className="size-5 text-chart-2" />
                          )}
                          {activity.type === "group" && (
                            <UsersRound className="size-5 text-chart-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {activity.action}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {activity.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {activity.time}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Teacher Activity */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                O&apos;qituvchilar faoliyati
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teacherActivity.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between rounded-xl bg-secondary/30 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                        {teacher.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {teacher.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.subject}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {teacher.lessonsToday} dars
                      </p>
                      <p className="text-xs text-success">
                        {teacher.attendance}% davomat
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Payments - Only for Owner */}
        {role === "owner" && (
          <Card className="rounded-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-destructive" />
                <CardTitle className="text-base font-semibold">
                  Kechikkan to&apos;lovlar
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                asChild
              >
                <Link href="/dashboard/payments">
                  Barchasini ko&apos;rish
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                        O&apos;quvchi
                      </th>
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                        Guruh
                      </th>
                      {canViewPaymentAmounts && (
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Summa
                        </th>
                      )}
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                        Holat
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                        Amal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overduePayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-4 text-sm font-medium text-foreground">
                          {payment.student}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {payment.group}
                        </td>
                        {canViewPaymentAmounts && (
                          <td className="py-4 text-sm text-foreground">
                            {payment.amount} so&apos;m
                          </td>
                        )}
                        <td className="py-4">
                          <StatusBadge status="overdue" />
                        </td>
                        <td className="py-4 text-right">
                          <Button variant="outline" size="sm">
                            Eslatma yuborish
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manager's simplified payment status view */}
        {role === "manager" && (
          <Card className="rounded-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-warning" />
                <CardTitle className="text-base font-semibold">
                  To&apos;lov holati
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                asChild
              >
                <Link href="/dashboard/payments">
                  Barchasini ko&apos;rish
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-success/10 p-4 text-center">
                  <p className="text-2xl font-bold text-success">5</p>
                  <p className="text-sm text-muted-foreground">
                    To&apos;langan
                  </p>
                </div>
                <div className="rounded-xl bg-warning/10 p-4 text-center">
                  <p className="text-2xl font-bold text-warning">2</p>
                  <p className="text-sm text-muted-foreground">Kutilmoqda</p>
                </div>
                <div className="rounded-xl bg-destructive/10 p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">3</p>
                  <p className="text-sm text-muted-foreground">Kechikkan</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
