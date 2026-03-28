"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CircleAlert, CheckCircle } from "lucide-react";
import {
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import {
  clearLegacyDashboardCache,
  formatCurrency,
  normalizeMoney,
  toYMD,
} from "@/lib-frontend/utils";

type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE";

interface PaymentRaw {
  id: string;
  student?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  group?: { id?: string; name?: string };
  billingMonth?: string;
  dueDate?: string;
  amount?: number | string;
  paidAmount?: number | string;
  status?: PaymentStatus;
  paidAt?: string | null;
  notes?: string | null;
}

interface PaymentView {
  id: string;
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  billingMonth: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  debtAmount: number;
  status: PaymentStatus;
  paidAt: string;
  notes: string;
}

interface GroupItem {
  id: string;
  name?: string;
}

interface Summary {
  group?: { id?: string; name?: string };
  billingMonth?: string;
  dueDate?: string;
  totals?: {
    expectedAmount?: number | string;
    collectedAmount?: number | string;
    debtAmount?: number | string;
    totalAmount?: number | string;
    paidAmount?: number | string;
  };
  paidStudents?: Array<{
    student?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
    };
    studentId?: string;
    studentName?: string;
    amount?: number | string;
  }>;
  debtors?: Array<{
    student?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
    };
    studentId?: string;
    studentName?: string;
    debtAmount?: number | string;
  }>;
  entries?: Array<{
    studentId?: string;
    studentName?: string;
    amount?: number | string;
    paidAmount?: number | string;
    debtAmount?: number | string;
  }>;
}

function parseSummary(payload: unknown): Summary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("totals" in (payload as Record<string, unknown>)) {
    return payload as Summary;
  }

  const obj = payload as Record<string, unknown>;
  const fromKey = obj.summary;
  if (fromKey && typeof fromKey === "object") {
    return fromKey as Summary;
  }

  return payload as Summary;
}

function parsePaymentStatus(status?: string): PaymentStatus {
  const value = String(status || "UNPAID").toUpperCase();
  if (
    value === "PAID" ||
    value === "UNPAID" ||
    value === "PARTIAL" ||
    value === "OVERDUE"
  ) {
    return value;
  }
  return "UNPAID";
}

function statusForBadge(
  status: PaymentStatus,
): "paid" | "unpaid" | "partial" | "overdue" {
  switch (status) {
    case "PAID":
      return "paid";
    case "PARTIAL":
      return "partial";
    case "OVERDUE":
      return "overdue";
    default:
      return "unpaid";
  }
}

function resolveStudentInfo(item: {
  student?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  studentId?: string;
  studentName?: string;
}) {
  const nestedName =
    item.student?.fullName ||
    `${item.student?.firstName || ""} ${item.student?.lastName || ""}`.trim();

  return {
    id: item.student?.id || item.studentId || "",
    name: nestedName || item.studentName || "Noma'lum",
  };
}

interface PaymentForm {
  id?: string;
  studentId: string;
  groupId: string;
  billingMonth: string;
  amount: string;
  paidAmount: string;
  notes: string;
}

const initialForm: PaymentForm = {
  studentId: "",
  groupId: "",
  billingMonth: toYMD(new Date()),
  amount: "",
  paidAmount: "",
  notes: "",
};

function summaryDueDate(summary: Summary | null, billingMonth: string): string {
  const fromApi = toYMD(summary?.dueDate);
  if (fromApi) return fromApi;
  const base = toYMD(summary?.billingMonth || billingMonth);
  if (!base) return "-";
  return `${base.slice(0, 8)}15`;
}

function mapPayment(item: PaymentRaw): PaymentView {
  const studentName =
    item.student?.fullName ||
    `${item.student?.firstName || ""} ${item.student?.lastName || ""}`.trim() ||
    "Noma'lum";
  const amount = normalizeMoney(item.amount);
  const paidAmount = normalizeMoney(item.paidAmount);

  return {
    id: item.id,
    studentId: item.student?.id || "",
    studentName,
    groupId: item.group?.id || "",
    groupName: item.group?.name || "-",
    billingMonth: toYMD(item.billingMonth) || "",
    dueDate: toYMD(item.dueDate) || "",
    amount,
    paidAmount,
    debtAmount: Math.max(0, amount - paidAmount),
    status: parsePaymentStatus(item.status),
    paidAt: toYMD(item.paidAt) || "",
    notes: item.notes || "",
  };
}

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useRole();

  const canAccessPayments = hasAccess(role, "payments");
  const canViewAmounts = role === "owner";

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<PaymentForm>(initialForm);

  const selectedGroupId = searchParams.get("groupId") || "all";
  const selectedStatus = searchParams.get("status") || "all";
  const selectedBillingMonth =
    searchParams.get("billingMonth") || toYMD(new Date());

  const updateFilters = (next: {
    groupId?: string;
    status?: string;
    billingMonth?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const groupId = next.groupId ?? selectedGroupId;
    const status = next.status ?? selectedStatus;
    const billingMonth = next.billingMonth ?? selectedBillingMonth;

    if (groupId === "all") params.delete("groupId");
    else params.set("groupId", groupId);

    if (status === "all") params.delete("status");
    else params.set("status", status);

    params.set("billingMonth", toYMD(billingMonth));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const loadAll = async () => {
    if (!canAccessPayments) return;

    setIsLoading(true);
    setError(null);

    try {
      const [groupsData, paymentsData] = await Promise.all([
        groupsAPI.list(),
        paymentsAPI.list({
          groupId: selectedGroupId === "all" ? undefined : selectedGroupId,
          billingMonth: selectedBillingMonth,
          status:
            selectedStatus === "all" ? undefined : selectedStatus.toUpperCase(),
        }),
      ]);

      const groupsList = extractList<GroupItem>(groupsData, ["groups"]);
      setGroups(groupsList);
      setPayments(
        extractList<PaymentRaw>(paymentsData, ["payments"]).map(mapPayment),
      );
      const summaryGroupId =
        selectedGroupId === "all" ? groupsList[0]?.id : selectedGroupId;

      if (summaryGroupId) {
        const summaryData = await paymentsAPI.summary({
          groupId: summaryGroupId,
          billingMonth: selectedBillingMonth,
        });
        setSummary(parseSummary(summaryData));
      } else {
        setSummary(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessPayments) {
      router.replace("/dashboard/attendance");
      return;
    }
    clearLegacyDashboardCache();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canAccessPayments,
    selectedGroupId,
    selectedStatus,
    selectedBillingMonth,
  ]);

  const stats = useMemo(() => {
    const totalAmount = payments.reduce((acc, item) => acc + item.amount, 0);
    const totalPaid = payments.reduce((acc, item) => acc + item.paidAmount, 0);
    const totalDebt = payments.reduce((acc, item) => acc + item.debtAmount, 0);

    return {
      totalAmount,
      totalPaid,
      totalDebt,
      paidCount: payments.filter((p) => p.status === "PAID").length,
      debtors: payments.filter((p) => p.status !== "PAID").length,
    };
  }, [payments]);

  const openCreate = () => {
    setFormData({ ...initialForm, billingMonth: selectedBillingMonth });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (item: PaymentView) => {
    setFormData({
      id: item.id,
      studentId: item.studentId,
      groupId: item.groupId,
      billingMonth: item.billingMonth,
      amount: String(item.amount),
      paidAmount: String(item.paidAmount),
      notes: item.notes,
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitForm = async () => {
    setFormError(null);
    setFieldErrors({});

    const amount = normalizeMoney(formData.amount);
    const paidAmount = normalizeMoney(formData.paidAmount);

    if (paidAmount > amount) {
      setFieldErrors({
        paidAmount: "paidAmount amountdan katta bo'lishi mumkin emas",
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        studentId: formData.studentId,
        groupId: formData.groupId,
        billingMonth: toYMD(formData.billingMonth),
        amount,
        paidAmount,
        notes: formData.notes.trim() || null,
      };

      if (formData.id) {
        await paymentsAPI.update(formData.id, payload);
      } else {
        await paymentsAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadAll();
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 400 || err.status === 409) &&
        err.fieldErrors
      ) {
        setFieldErrors(err.fieldErrors);
      }
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!canAccessPayments) return null;

  const columns = [
    {
      key: "studentName",
      header: "O'quvchi",
      render: (item: PaymentView) => (
        <span className="font-medium">{item.studentName}</span>
      ),
    },
    {
      key: "groupName",
      header: "Guruh",
      render: (item: PaymentView) => (
        <span className="text-muted-foreground">{item.groupName}</span>
      ),
    },
    {
      key: "billingMonth",
      header: "Billing month",
      render: (item: PaymentView) => (
        <span className="text-muted-foreground">
          {item.billingMonth || "-"}
        </span>
      ),
    },
    ...(canViewAmounts
      ? [
          {
            key: "amount",
            header: "Amount",
            render: (item: PaymentView) => (
              <span>{formatCurrency(item.amount)}</span>
            ),
          },
          {
            key: "paidAmount",
            header: "Paid",
            render: (item: PaymentView) => (
              <span className="text-success">
                {formatCurrency(item.paidAmount)}
              </span>
            ),
          },
          {
            key: "debtAmount",
            header: "Debt",
            render: (item: PaymentView) => (
              <span className="text-destructive">
                {formatCurrency(item.debtAmount)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Holat",
      render: (item: PaymentView) => (
        <StatusBadge status={statusForBadge(item.status)} />
      ),
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (item: PaymentView) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(item)}>
                Tahrirlash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <DashboardHeader title="To'lovlar" />

      <div className="space-y-6 p-6">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filterlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Guruh</Label>
              <Select
                value={selectedGroupId}
                onValueChange={(value) => updateFilters({ groupId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Guruh tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name || g.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => updateFilters({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                  <SelectItem value="UNPAID">UNPAID</SelectItem>
                  <SelectItem value="OVERDUE">OVERDUE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>billingMonth (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={selectedBillingMonth}
                onChange={(e) =>
                  updateFilters({ billingMonth: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Jami tushum</p>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(stats.totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Jami qarz</p>
              <p className="text-lg font-semibold text-destructive">
                {formatCurrency(stats.totalDebt)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Kim to'lagan</p>
              <p className="text-lg font-semibold">{stats.paidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Kim qarzdor</p>
              <p className="text-lg font-semibold">{stats.debtors}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>Guruh: {summary?.group?.name || "-"}</p>
            <p>
              Billing month:{" "}
              {toYMD(summary?.billingMonth) || selectedBillingMonth}
            </p>
            <p>Due date: {summaryDueDate(summary, selectedBillingMonth)}</p>
            <p>
              Jami amount:{" "}
              {formatCurrency(
                summary?.totals?.expectedAmount ?? summary?.totals?.totalAmount,
              )}
            </p>
            <p>
              Jami paid:{" "}
              {formatCurrency(
                summary?.totals?.collectedAmount ?? summary?.totals?.paidAmount,
              )}
            </p>
            <p>Jami debt: {formatCurrency(summary?.totals?.debtAmount)}</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 font-medium">Kim to'lagan</p>
                {summary?.paidStudents && summary.paidStudents.length > 0 ? (
                  <ul className="space-y-1">
                    {summary.paidStudents.map((item) => {
                      const student = resolveStudentInfo(item);
                      return (
                        <li
                          key={`${student.id}-${student.name}`}
                          className="flex justify-between rounded border p-2"
                        >
                          <span>{student.name}</span>
                          <span>{formatCurrency(item.amount)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Ma'lumot yo'q</p>
                )}
              </div>

              <div>
                <p className="mb-2 font-medium">Kim qarzdor</p>
                {summary?.debtors && summary.debtors.length > 0 ? (
                  <ul className="space-y-1">
                    {summary.debtors.map((item) => {
                      const student = resolveStudentInfo(item);
                      return (
                        <li
                          key={`${student.id}-${student.name}`}
                          className="flex justify-between rounded border p-2"
                        >
                          <span>{student.name}</span>
                          <span className="text-destructive">
                            {formatCurrency(item.debtAmount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Ma'lumot yo'q</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <DataTable
          data={payments}
          columns={columns}
          searchPlaceholder="Payment qidirish..."
          addButtonLabel="To'lov qo'shish"
          onAddClick={openCreate}
          showFilters={false}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {formData.id ? "To'lovni tahrirlash" : "To'lov qo'shish"}
              </DialogTitle>
              <DialogDescription>
                paidAmount amountdan katta bo'lmasligi kerak.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {formError && (
                <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                  {formError}
                </p>
              )}

              <div className="space-y-1">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      studentId: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="groupId">Group ID</Label>
                <Input
                  id="groupId"
                  value={formData.groupId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      groupId: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="billingMonth">Billing month</Label>
                <Input
                  id="billingMonth"
                  type="date"
                  value={formData.billingMonth}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      billingMonth: toYMD(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paidAmount">Paid amount</Label>
                  <Input
                    id="paidAmount"
                    value={formData.paidAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        paidAmount: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              {Object.keys(fieldErrors).map((key) => (
                <p key={key} className="text-xs text-destructive">
                  {fieldErrors[key]}
                </p>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button onClick={submitForm} disabled={isSaving}>
                {isSaving ? (
                  <CircleAlert className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 size-4" />
                )}
                Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
