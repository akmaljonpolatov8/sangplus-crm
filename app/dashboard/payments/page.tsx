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
import {
  MoreHorizontal,
  Plus,
  CreditCard,
  CircleAlert,
  CheckCircle,
} from "lucide-react";
import {
  ApiClientError,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency, normalizeMoney, toYMD } from "@/lib-frontend/utils";

type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";

interface PaymentItem {
  id: string;
  studentName?: string | null;
  student?: string | null;
  studentId?: string | null;
  groupName?: string | null;
  group?: string | null;
  groupId?: string | null;
  billingMonth?: string | null;
  amount?: number | string | null;
  paidAmount?: number | string | null;
  debtAmount?: number | string | null;
  status?: PaymentStatus | string | null;
  paymentDate?: string | null;
  paidDate?: string | null;
}

interface GroupItem {
  id: string;
  name?: string | null;
  monthlyFee?: number | string | null;
}

interface PaymentSummary {
  group?: {
    id?: string;
    name?: string;
  } | null;
  billingMonth?: string | null;
  dueDate?: string | null;
  totals?: {
    totalAmount?: number | string;
    paidAmount?: number | string;
    debtAmount?: number | string;
  } | null;
  paidStudents?: Array<{
    studentId?: string;
    studentName?: string;
    amount?: number | string;
  }>;
  debtors?: Array<{
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
    status?: string;
  }>;
}

interface PaymentFormState {
  id?: string;
  studentId: string;
  groupId: string;
  billingMonth: string;
  amount: string;
  paidAmount: string;
  paymentDate: string;
}

const initialForm: PaymentFormState = {
  studentId: "",
  groupId: "",
  billingMonth: toYMD(new Date()),
  amount: "",
  paidAmount: "",
  paymentDate: toYMD(new Date()),
};

function safeStatus(value: unknown): PaymentStatus {
  if (
    value === "paid" ||
    value === "unpaid" ||
    value === "partial" ||
    value === "overdue"
  ) {
    return value;
  }
  return "unpaid";
}

function dueDateFromMonth(month: string): string {
  if (!month) return "-";
  const ymd = toYMD(month);
  if (!ymd) return "-";
  return `${ymd.slice(0, 8)}15`;
}

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useRole();

  const canAccessPayments = hasAccess(role, "payments");
  const canViewAmounts = role === "owner";

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState<PaymentFormState>(initialForm);

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

    if (!groupId || groupId === "all") params.delete("groupId");
    else params.set("groupId", groupId);

    if (!status || status === "all") params.delete("status");
    else params.set("status", status);

    if (!billingMonth) params.delete("billingMonth");
    else params.set("billingMonth", billingMonth);

    router.replace(`${pathname}?${params.toString()}`);
  };

  const loadGroups = async () => {
    const list = await groupsAPI.list();
    setGroups(Array.isArray(list) ? list : []);
  };

  const loadPayments = async () => {
    const list = await paymentsAPI.list({
      groupId: selectedGroupId === "all" ? undefined : selectedGroupId,
      status: selectedStatus === "all" ? undefined : selectedStatus,
      billingMonth: selectedBillingMonth || undefined,
    });
    setPayments(Array.isArray(list) ? list : []);
  };

  const loadSummary = async () => {
    if (!selectedBillingMonth) {
      setSummary(null);
      return;
    }

    const data = await paymentsAPI.summary({
      groupId: selectedGroupId === "all" ? undefined : selectedGroupId,
      billingMonth: selectedBillingMonth,
    });

    setSummary(data ?? null);
  };

  const loadAll = async () => {
    if (!canAccessPayments) return;

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([loadGroups(), loadPayments(), loadSummary()]);
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
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canAccessPayments,
    selectedGroupId,
    selectedStatus,
    selectedBillingMonth,
  ]);

  const paymentStats = useMemo(() => {
    const totalAmount = payments.reduce(
      (acc, item) => acc + normalizeMoney(item.amount),
      0,
    );
    const totalPaid = payments.reduce(
      (acc, item) => acc + normalizeMoney(item.paidAmount),
      0,
    );
    const totalDebt = payments.reduce(
      (acc, item) => acc + normalizeMoney(item.debtAmount),
      0,
    );

    const paidCount = payments.filter(
      (p) => safeStatus(p.status) === "paid",
    ).length;
    const debtorCount = payments.filter((p) => {
      const status = safeStatus(p.status);
      return (
        status === "overdue" || status === "partial" || status === "unpaid"
      );
    }).length;

    return {
      totalAmount,
      totalPaid,
      totalDebt,
      paidCount,
      debtorCount,
    };
  }, [payments]);

  const openCreate = () => {
    setFormState({
      ...initialForm,
      billingMonth: selectedBillingMonth || toYMD(new Date()),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (payment: PaymentItem) => {
    setFormState({
      id: payment.id,
      studentId: payment.studentId || "",
      groupId: payment.groupId || "",
      billingMonth:
        toYMD(payment.billingMonth) ||
        selectedBillingMonth ||
        toYMD(new Date()),
      amount: String(payment.amount ?? ""),
      paidAmount: String(payment.paidAmount ?? ""),
      paymentDate:
        toYMD(payment.paymentDate || payment.paidDate) || toYMD(new Date()),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitForm = async () => {
    setFormError(null);
    setFieldErrors({});

    const amount = normalizeMoney(formState.amount);
    const paidAmount = normalizeMoney(formState.paidAmount);

    if (paidAmount > amount) {
      setFieldErrors({
        paidAmount: "Paid amount amountdan katta bo'lishi mumkin emas",
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        studentId: formState.studentId || undefined,
        groupId: formState.groupId || undefined,
        billingMonth: toYMD(formState.billingMonth),
        amount,
        paidAmount,
        paymentDate: toYMD(formState.paymentDate),
      };

      if (formState.id) {
        await paymentsAPI.update(formState.id, payload);
      } else {
        await paymentsAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadAll();
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 400 || err.status === 409)
      ) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
      }
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!canAccessPayments) {
    return null;
  }

  const summaryDueDate = summary?.dueDate
    ? toYMD(summary.dueDate)
    : dueDateFromMonth(summary?.billingMonth || selectedBillingMonth);

  const columns = [
    {
      key: "studentName",
      header: "O'quvchi",
      render: (item: PaymentItem) => (
        <span className="font-medium text-foreground">
          {item.studentName || item.student || "-"}
        </span>
      ),
    },
    {
      key: "groupName",
      header: "Guruh",
      render: (item: PaymentItem) => (
        <span className="text-muted-foreground">
          {item.groupName || item.group || "-"}
        </span>
      ),
    },
    {
      key: "billingMonth",
      header: "Billing month",
      render: (item: PaymentItem) => (
        <span className="text-muted-foreground">
          {toYMD(item.billingMonth) || "-"}
        </span>
      ),
    },
    ...(canViewAmounts
      ? [
          {
            key: "amount",
            header: "Amount",
            render: (item: PaymentItem) => (
              <span className="font-medium text-foreground">
                {formatCurrency(item.amount)}
              </span>
            ),
          },
          {
            key: "paidAmount",
            header: "Paid",
            render: (item: PaymentItem) => (
              <span className="font-medium text-success">
                {formatCurrency(item.paidAmount)}
              </span>
            ),
          },
          {
            key: "debtAmount",
            header: "Debt",
            render: (item: PaymentItem) => (
              <span className="font-medium text-destructive">
                {formatCurrency(item.debtAmount)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      render: (item: PaymentItem) => (
        <StatusBadge status={safeStatus(item.status)} />
      ),
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (item: PaymentItem) => (
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
            <CardContent className="flex items-center gap-2 p-4 text-destructive">
              <CircleAlert className="size-4" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <Card className="rounded-2xl">
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
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name || "Noma'lum guruh"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing month (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={selectedBillingMonth}
                onChange={(e) =>
                  updateFilters({ billingMonth: toYMD(e.target.value) })
                }
              />
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
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Jami tushum</p>
              <p className="text-xl font-semibold text-success">
                {formatCurrency(paymentStats.totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Jami qarz</p>
              <p className="text-xl font-semibold text-destructive">
                {formatCurrency(paymentStats.totalDebt)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Kim to'lagan</p>
              <p className="text-xl font-semibold text-foreground">
                {paymentStats.paidCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Qarzdorlar</p>
              <p className="text-xl font-semibold text-foreground">
                {paymentStats.debtorCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Payments summary (oy/guruh)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Guruh: {summary?.group?.name || "-"} | Billing month:{" "}
              {toYMD(summary?.billingMonth) || selectedBillingMonth || "-"} |
              Due date: {summaryDueDate}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Jami amount</p>
                <p className="font-semibold">
                  {formatCurrency(summary?.totals?.totalAmount)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">To'langan</p>
                <p className="font-semibold text-success">
                  {formatCurrency(summary?.totals?.paidAmount)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Qarz</p>
                <p className="font-semibold text-destructive">
                  {formatCurrency(summary?.totals?.debtAmount)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className="font-semibold">{summary?.entries?.length || 0}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Kim to'lagan</p>
                {summary?.paidStudents?.length ? (
                  <ul className="space-y-1 text-sm">
                    {summary.paidStudents.map((item) => (
                      <li
                        key={`${item.studentId}-${item.studentName}`}
                        className="flex items-center justify-between rounded border p-2"
                      >
                        <span>{item.studentName || "Noma'lum"}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Ma'lumot yo'q</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Kim qarzdor</p>
                {summary?.debtors?.length ? (
                  <ul className="space-y-1 text-sm">
                    {summary.debtors.map((item) => (
                      <li
                        key={`${item.studentId}-${item.studentName}`}
                        className="flex items-center justify-between rounded border p-2"
                      >
                        <span>{item.studentName || "Noma'lum"}</span>
                        <span className="text-destructive">
                          {formatCurrency(item.debtAmount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Ma'lumot yo'q</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <DataTable
          data={payments}
          columns={columns}
          searchPlaceholder="Payment qidirish..."
          showFilters={false}
          addButtonLabel="To'lov qo'shish"
          onAddClick={openCreate}
        />

        {!isLoading && payments.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <CreditCard className="size-8" />
              <p>To'lovlar topilmadi</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {formState.id ? "To'lovni tahrirlash" : "To'lov qo'shish"}
              </DialogTitle>
              <DialogDescription>
                `paidAmount` qiymati `amount`dan katta bo'lmasligi shart.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {formError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                  {formError}
                </p>
              )}

              <div className="space-y-1">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={formState.studentId}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      studentId: e.target.value,
                    }))
                  }
                />
                {fieldErrors.studentId && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.studentId}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="groupId">Group ID</Label>
                <Input
                  id="groupId"
                  value={formState.groupId}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      groupId: e.target.value,
                    }))
                  }
                />
                {fieldErrors.groupId && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.groupId}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="billingMonth">Billing month (YYYY-MM-DD)</Label>
                <Input
                  id="billingMonth"
                  type="date"
                  value={formState.billingMonth}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      billingMonth: toYMD(e.target.value),
                    }))
                  }
                />
                {fieldErrors.billingMonth && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.billingMonth}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    value={formState.amount}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                  />
                  {fieldErrors.amount && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.amount}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paidAmount">Paid amount</Label>
                  <Input
                    id="paidAmount"
                    value={formState.paidAmount}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        paidAmount: e.target.value,
                      }))
                    }
                  />
                  {fieldErrors.paidAmount && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.paidAmount}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="paymentDate">Payment date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formState.paymentDate}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      paymentDate: toYMD(e.target.value),
                    }))
                  }
                />
                {fieldErrors.paymentDate && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.paymentDate}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                onClick={submitForm}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <CircleAlert className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" />
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
