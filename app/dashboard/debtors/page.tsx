"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  extractList,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency } from "@/lib-frontend/utils";

interface GroupItem {
  id: string;
  name?: string;
}

interface DebtorItem {
  paymentId: string;
  studentId: string;
  studentName: string;
  phone?: string | null;
  parentPhone?: string | null;
  groupId: string;
  groupName: string;
  dueDate: string;
  daysOverdue: number;
  amount?: number;
}

export default function DebtorsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "payments");
  const canViewAmounts = role === "owner";

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [debtors, setDebtors] = useState<DebtorItem[]>([]);
  const [groupId, setGroupId] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupsData, debtorsData] = await Promise.all([
        groupsAPI.list(),
        paymentsAPI.debtors({
          groupId: groupId === "all" ? undefined : groupId,
          limit: 500,
        }),
      ]);

      setGroups(extractList<GroupItem>(groupsData, ["groups"]));
      const debtorList = extractList<DebtorItem>(debtorsData, ["debtors"]);
      setDebtors(
        debtorList.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0)),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, groupId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return debtors;

    return debtors.filter((item) =>
      [item.studentName, item.phone, item.parentPhone, item.groupName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [debtors, search]);

  if (!canAccess) return null;

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Qarzdorlar" />

      <div className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filterlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Guruh</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Guruh tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name || group.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Qidiruv</Label>
              <Input
                placeholder="Ism, telefon yoki guruh bo'yicha qidiring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Qarzdorlar topilmadi
                </CardContent>
              </Card>
            ) : (
              filtered.map((item) => (
                <Card key={item.paymentId}>
                  <CardContent className="space-y-1 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.studentName}</p>
                      <p className="text-destructive">
                        {item.daysOverdue} kun kechikkan
                      </p>
                    </div>
                    <p>Guruh: {item.groupName}</p>
                    <p>Telefon: {item.phone || "-"}</p>
                    <p>Ota-ona telefoni: {item.parentPhone || "-"}</p>
                    {canViewAmounts ? (
                      <p className="text-destructive">
                        Qarz: {formatCurrency(item.amount)}
                      </p>
                    ) : null}
                    <Button variant="outline" disabled>
                      SMS yuborish
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
