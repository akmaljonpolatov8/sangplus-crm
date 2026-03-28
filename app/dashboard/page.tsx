"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  dashboardAPI,
  getApiErrorMessage,
  paymentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency, toYMD } from "@/lib-frontend/utils";

interface DashboardStats {
  totalStudents?: number;
  totalTeachers?: number;
  totalGroups?: number;
  attendanceRate?: number;
}

interface SummaryTotals {
  totalAmount?: number | string;
  paidAmount?: number | string;
  debtAmount?: number | string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, isLoaded } = useRole();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summaryTotals, setSummaryTotals] = useState<SummaryTotals | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && role === "teacher") {
      router.replace("/dashboard/attendance");
    }
  }, [isLoaded, role, router]);

  useEffect(() => {
    if (!isLoaded || role === "teacher") return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [statsData, summaryData] = await Promise.all([
          dashboardAPI.getStats(),
          paymentsAPI.summary({ billingMonth: toYMD(new Date()) }),
        ]);

        setStats(statsData || null);
        setSummaryTotals(summaryData?.totals || null);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isLoaded, role]);

  if (!isLoaded || role === "teacher") {
    return null;
  }

  const canSeePayments = hasAccess(role, "payments");
  const canSeeAmounts = role === "owner";

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Boshqaruv paneli" />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                O'quvchilar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats?.totalStudents ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                O'qituvchilar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats?.totalTeachers ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Guruhlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats?.totalGroups ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Davomat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {stats?.attendanceRate ?? 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {canSeePayments && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>To'lovlar snapshot</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/payments">To'lovlar sahifasi</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami amount</p>
                <p className="text-lg font-semibold">
                  {canSeeAmounts
                    ? formatCurrency(summaryTotals?.totalAmount)
                    : "Yashirilgan"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami tushum</p>
                <p className="text-lg font-semibold text-success">
                  {canSeeAmounts
                    ? formatCurrency(summaryTotals?.paidAmount)
                    : "Yashirilgan"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami qarz</p>
                <p className="text-lg font-semibold text-destructive">
                  {canSeeAmounts
                    ? formatCurrency(summaryTotals?.debtAmount)
                    : "Yashirilgan"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/students">Students</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/teachers">Teachers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/groups">Groups</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/lessons">Lessons</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
