"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  extractList,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
  studentsAPI,
  teachersAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency, toYMD } from "@/lib-frontend/utils";

interface DashboardTotals {
  students: number;
  teachers: number;
  groups: number;
  payments: number;
}

interface SummaryTotals {
  expectedAmount?: number | string;
  collectedAmount?: number | string;
  debtAmount?: number | string;
  totalAmount?: number | string;
  paidAmount?: number | string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, isLoaded } = useRole();
  const [totals, setTotals] = useState<DashboardTotals>({
    students: 0,
    teachers: 0,
    groups: 0,
    payments: 0,
  });
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
        const [students, teachers, groups, payments] = await Promise.all([
          studentsAPI.list(),
          teachersAPI.list(),
          groupsAPI.list(),
          paymentsAPI.list({ billingMonth: toYMD(new Date()) }),
        ]);

        const studentList = extractList(students, ["students"]);
        const teacherList = extractList(teachers, ["teachers"]);
        const groupList = extractList<{ id?: string }>(groups, ["groups"]);
        const paymentList = extractList(payments, ["payments"]);

        setTotals({
          students: studentList.length,
          teachers: teacherList.length,
          groups: groupList.length,
          payments: paymentList.length,
        });

        const summaryGroupId = groupList[0]?.id;

        if (summaryGroupId) {
          const paymentsSummary = await paymentsAPI.summary({
            groupId: summaryGroupId,
            billingMonth: toYMD(new Date()),
          });
          const summaryLike = paymentsSummary as { totals?: SummaryTotals };
          setSummaryTotals(summaryLike.totals || null);
        } else {
          setSummaryTotals(null);
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isLoaded, role]);

  if (!isLoaded || role === "teacher") return null;

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
                O&apos;quvchilar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totals.students}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                O&apos;qituvchilar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totals.teachers}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Guruhlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totals.groups}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Payment yozuvlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totals.payments}</p>
            </CardContent>
          </Card>
        </div>

        {canSeePayments && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>To&apos;lovlar summary</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/payments">To&apos;lovlar sahifasi</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami amount</p>
                <p className="text-lg font-semibold">
                  {canSeeAmounts
                    ? formatCurrency(
                        summaryTotals?.expectedAmount ??
                          summaryTotals?.totalAmount,
                      )
                    : "Yashirilgan"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami tushum</p>
                <p className="text-lg font-semibold text-success">
                  {canSeeAmounts
                    ? formatCurrency(
                        summaryTotals?.collectedAmount ??
                          summaryTotals?.paidAmount,
                      )
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
      </div>
    </div>
  );
}
