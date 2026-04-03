"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CircleAlert, Pencil } from "lucide-react";
import {
  extractList,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
  studentsAPI,
  smsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import {
  clearLegacyDashboardCache,
  formatCurrency,
  normalizeMoney,
  toYMD,
} from "@/lib-frontend/utils";
import { toast } from "@/hooks/use-toast";

type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE";

interface GroupItem {
  id: string;
  name?: string;
  monthlyFee?: number | string;
}

interface PaymentView {
  id: string;
  paymentId?: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    parentPhone?: string | null;
    parentName?: string | null;
  };
  group: {
    id: string;
    name: string;
  };
  billingMonth: string;
  dueDate: string;
  status: PaymentStatus;
  amount?: number;
  paidAmount?: number;
  notes?: string | null;
}

interface Summary {
  paidStudents?: Array<{
    studentId?: string;
    studentName?: string;
    amount?: number;
  }>;
  debtors?: Array<{
    studentId?: string;
    studentName?: string;
    debtAmount?: number;
  }>;
}

interface OverdueStudent {
  studentId: string;
  fullName: string;
  groupName: string;
  parentPhone: string;
  parentName?: string | null;
  monthlyFee: number;
  daysOverdue: number;
  billingMonth: string;
}

interface SmsHistoryItem {
  id: string;
  message: string;
  sentAt: string;
  status: string;
  type: string;
  parentPhone: string;
}

interface GroupBulkRow {
  studentId: string;
  studentName: string;
  phone?: string | null;
  paid: boolean;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  paymentId?: string | null;
}

interface PaymentForm {
  id?: string;
  studentId: string;
  groupId: string;
  billingMonth: string;
  amount: string;
  paidAmount: string;
  notes: string;
  status: PaymentStatus;
}

interface StudentItem {
  id: string;
  firstName?: string;
  lastName?: string;
}

const CENTER_PHONE = process.env.NEXT_PUBLIC_CENTER_PHONE || "+998900000000";

function parseStatus(status?: string): PaymentStatus {
  if (
    status === "PAID" ||
    status === "UNPAID" ||
    status === "PARTIAL" ||
    status === "OVERDUE"
  ) {
    return status;
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

function toMonthValue(value: string): string {
  const ymd = toYMD(value);
  return ymd ? ymd.slice(0, 7) : toYMD(new Date()).slice(0, 7);
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01`);
  if (Number.isNaN(date.getTime())) return "joriy";
  return date.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
}

function buildSmsText(input: {
  parentName?: string | null;
  studentName: string;
  billingMonth: string;
  amount?: number;
}) {
  const parentName = input.parentName?.trim() || "ota-ona";
  const billingMonthLabel = monthLabel(input.billingMonth);
  const currentMonthLabel = monthLabel(toMonthValue(toYMD(new Date())));
  const amountText =
    input.amount != null
      ? formatCurrency(input.amount).replace(" so'm", "")
      : "belgilangan";

  return `Assalomu alaykum, ${parentName}!\nFarzandingiz ${input.studentName}ning ${billingMonthLabel} oyi uchun ${amountText} so'm to'lovi amalga oshirilmagan.\nIltimos, to'lovni ${currentMonthLabel} oyining oxirigacha amalga oshiring.\nSangPlus o'quv markazi. Tel: ${CENTER_PHONE}`.slice(
    0,
    160,
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useRole();

  const canAccess = hasAccess(role, "payments");
  const canViewAmounts = role === "owner";

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [, setSummary] = useState<Summary | null>(null);
  const [overdueRows, setOverdueRows] = useState<OverdueStudent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    studentId: "",
    groupId: "",
    billingMonth: `${toMonthValue(toYMD(new Date()))}-01`,
    amount: "",
    paidAmount: "",
    notes: "",
    status: "UNPAID",
  });
  const [formStudents, setFormStudents] = useState<StudentItem[]>([]);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupStep, setGroupStep] = useState<1 | 2>(1);
  const [groupFlow, setGroupFlow] = useState({
    groupId: "",
    billingMonth: toMonthValue(toYMD(new Date())),
    monthlyFee: "0",
  });
  const [groupRows, setGroupRows] = useState<GroupBulkRow[]>([]);
  const [isLoadingGroupRows, setIsLoadingGroupRows] = useState(false);

  const [smsModal, setSmsModal] = useState({
    open: false,
    studentId: "",
    studentName: "",
    parentPhone: "",
    message: "",
  });
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSentAtMap, setSmsSentAtMap] = useState<Record<string, string>>({});

  const [historyModal, setHistoryModal] = useState({
    open: false,
    studentName: "",
    loading: false,
    rows: [] as SmsHistoryItem[],
  });

  const selectedGroupId = searchParams.get("groupId") || "all";
  const selectedStatus = searchParams.get("status") || "all";
  const selectedMonth =
    searchParams.get("month") || toMonthValue(toYMD(new Date()));

  const updateFilters = (next: {
    groupId?: string;
    status?: string;
    month?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const groupId = next.groupId ?? selectedGroupId;
    const status = next.status ?? selectedStatus;
    const month = next.month ?? selectedMonth;

    if (groupId === "all") params.delete("groupId");
    else params.set("groupId", groupId);

    if (status === "all") params.delete("status");
    else params.set("status", status);

    params.set("month", month);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const loadAll = async () => {
    if (!canAccess) return;

    setIsLoading(true);
    setError(null);
    try {
      const [groupsData, paymentsData, overdueData] = await Promise.all([
        groupsAPI.list(),
        paymentsAPI.list({
          groupId: selectedGroupId === "all" ? undefined : selectedGroupId,
          month: selectedMonth,
          status: selectedStatus === "all" ? undefined : selectedStatus,
        }),
        paymentsAPI.overdue({
          groupId: selectedGroupId === "all" ? undefined : selectedGroupId,
        }),
      ]);

      const groupsList = extractList<GroupItem>(groupsData, ["groups"]);
      setGroups(groupsList);

      const paymentRows = extractList<Record<string, unknown>>(paymentsData, [
        "payments",
      ])
        .map((row) => {
          const student = (row.student || {}) as Record<string, unknown>;
          const group = (row.group || {}) as Record<string, unknown>;
          return {
            id: String(row.id || ""),
            paymentId: row.paymentId
              ? String(row.paymentId)
              : row.id
                ? String(row.id)
                : null,
            student: {
              id: String(student.id || ""),
              firstName: String(student.firstName || ""),
              lastName: String(student.lastName || ""),
              phone: student.phone as string | null | undefined,
              parentPhone: student.parentPhone as string | null | undefined,
              parentName: student.parentName as string | null | undefined,
            },
            group: {
              id: String(group.id || ""),
              name: String(group.name || "-"),
            },
            billingMonth:
              toYMD(row.billingMonth as string) || `${selectedMonth}-01`,
            dueDate: toYMD(row.dueDate as string) || `${selectedMonth}-15`,
            status: parseStatus(String(row.status || "UNPAID")),
            amount: canViewAmounts ? normalizeMoney(row.amount) : undefined,
            paidAmount: canViewAmounts
              ? normalizeMoney(row.paidAmount)
              : undefined,
            notes: (row.notes as string | null | undefined) || null,
          } satisfies PaymentView;
        })
        .filter((row) => {
          if (selectedStatus === "all") return true;
          return row.status === selectedStatus;
        });
      setPayments(paymentRows);

      const overdueList = extractList<OverdueStudent>(overdueData, [
        "overdue",
        "students",
      ]);
      setOverdueRows(overdueList);

      if (selectedGroupId !== "all") {
        const summaryData = await paymentsAPI.summary({
          groupId: selectedGroupId,
          billingMonth: `${selectedMonth}-01`,
        });
        setSummary((summaryData as Summary) || null);
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
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    clearLegacyDashboardCache();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, selectedGroupId, selectedStatus, selectedMonth]);

  const refreshAll = async () => {
    await loadAll();
  };

  const openEditModal = (payment: PaymentView) => {
    setPaymentForm({
      id: payment.paymentId || payment.id,
      studentId: payment.student.id,
      groupId: payment.group.id,
      billingMonth: toYMD(payment.billingMonth),
      amount: String(payment.amount ?? 0),
      paidAmount: String(payment.paidAmount ?? 0),
      notes: payment.notes || "",
      status: payment.status,
    });
    setFormStudents([
      {
        id: payment.student.id,
        firstName: payment.student.firstName,
        lastName: payment.student.lastName,
      },
    ]);
    setEditOpen(true);
  };

  const openCreateModal = async () => {
    const defaultGroupId =
      selectedGroupId === "all" ? groups[0]?.id || "" : selectedGroupId;
    setPaymentForm({
      studentId: "",
      groupId: defaultGroupId,
      billingMonth: `${selectedMonth}-01`,
      amount: "",
      paidAmount: "",
      notes: "",
      status: "UNPAID",
    });

    if (defaultGroupId) {
      const studentsData = await studentsAPI.list({ groupId: defaultGroupId });
      setFormStudents(extractList<StudentItem>(studentsData, ["students"]));
    } else {
      setFormStudents([]);
    }

    setEditOpen(true);
  };

  const saveEditPayment = async () => {
    setIsSaving(true);
    try {
      const amount = normalizeMoney(paymentForm.amount);
      let paidAmount = normalizeMoney(paymentForm.paidAmount);
      if (paymentForm.status === "PAID") {
        paidAmount = amount;
      } else if (paymentForm.status === "UNPAID") {
        paidAmount = 0;
      }

      if (paymentForm.id) {
        await paymentsAPI.update(paymentForm.id, {
          amount,
          paidAmount,
          notes: paymentForm.notes.trim() || null,
        });
      } else {
        await paymentsAPI.create({
          studentId: paymentForm.studentId,
          groupId: paymentForm.groupId,
          billingMonth: paymentForm.billingMonth,
          amount,
          paidAmount,
          notes: paymentForm.notes.trim() || null,
        });
      }

      toast({ title: "To'lov yangilandi" });
      setEditOpen(false);
      await refreshAll();
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast({
        title: "Saqlashda xatolik",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startGroupFlow = () => {
    setGroupStep(1);
    setGroupRows([]);
    setGroupFlow({
      groupId: selectedGroupId !== "all" ? selectedGroupId : "",
      billingMonth: selectedMonth,
      monthlyFee: "0",
    });
    setGroupModalOpen(true);
  };

  const loadGroupPaymentRows = async () => {
    if (!groupFlow.groupId) return;

    setIsLoadingGroupRows(true);
    try {
      const [groupPaymentsData, groupsData] = await Promise.all([
        paymentsAPI.list({
          groupId: groupFlow.groupId,
          month: groupFlow.billingMonth,
        }),
        groupsAPI.list(),
      ]);

      const allGroups = extractList<GroupItem>(groupsData, ["groups"]);
      const selectedGroup = allGroups.find(
        (item) => item.id === groupFlow.groupId,
      );
      const fee = normalizeMoney(
        selectedGroup?.monthlyFee ?? groupFlow.monthlyFee,
      );

      setGroupFlow((prev) => ({
        ...prev,
        monthlyFee: String(fee || 0),
      }));

      const rows = extractList<Record<string, unknown>>(groupPaymentsData, [
        "payments",
      ]).map((item) => {
        const student = (item.student || {}) as Record<string, unknown>;
        const amount = normalizeMoney(item.amount ?? fee);
        const paidAmount = normalizeMoney(item.paidAmount);
        const status = parseStatus(String(item.status || "UNPAID"));
        return {
          studentId: String(student.id || ""),
          studentName:
            `${String(student.firstName || "")} ${String(student.lastName || "")}`.trim(),
          phone:
            (student.phone as string | null | undefined) ||
            (student.parentPhone as string | null | undefined),
          paid: status === "PAID" || paidAmount >= amount,
          amount,
          paidAmount,
          status,
          paymentId: item.paymentId ? String(item.paymentId) : null,
        } satisfies GroupBulkRow;
      });
      setGroupRows(rows);
      setGroupStep(2);
    } catch (err) {
      toast({
        title: "Guruh o'quvchilari yuklanmadi",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsLoadingGroupRows(false);
    }
  };

  const markAllPaid = () => {
    const defaultAmount = normalizeMoney(groupFlow.monthlyFee);
    setGroupRows((prev) =>
      prev.map((row) => ({
        ...row,
        paid: true,
        paidAmount:
          row.paidAmount > 0 ? row.paidAmount : defaultAmount || row.amount,
        status: "PAID",
      })),
    );
  };

  const saveGroupPayments = async () => {
    if (!groupFlow.groupId) return;

    setIsSaving(true);
    try {
      const payload = groupRows.map((row) => {
        const amount = row.amount || normalizeMoney(groupFlow.monthlyFee);
        const paidAmount = row.paid ? row.paidAmount || amount : 0;
        const status =
          paidAmount >= amount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
        return {
          studentId: row.studentId,
          amount,
          paidAmount,
          status,
        };
      });

      await paymentsAPI.bulk({
        groupId: groupFlow.groupId,
        billingMonth: `${groupFlow.billingMonth}-01`,
        payments: payload,
      });

      toast({ title: "To'lovlar saqlandi!" });
      setGroupModalOpen(false);
      await refreshAll();
    } catch (err) {
      toast({
        title: "Bulk saqlashda xatolik",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openSmsForPayment = (item: PaymentView) => {
    const studentName =
      `${item.student.firstName} ${item.student.lastName}`.trim();
    setSmsModal({
      open: true,
      studentId: item.student.id,
      studentName,
      parentPhone: item.student.parentPhone || "",
      message: buildSmsText({
        parentName: item.student.parentName,
        studentName,
        billingMonth: toMonthValue(item.billingMonth),
        amount: item.amount,
      }),
    });
  };

  const sendSingleSms = async () => {
    setIsSendingSms(true);
    try {
      const result = (await smsAPI.send({
        studentId: smsModal.studentId,
        parentPhone: smsModal.parentPhone,
        message: smsModal.message,
        type: "PAYMENT_REMINDER",
      })) as { sentAt?: string };

      if (result?.sentAt) {
        setSmsSentAtMap((prev) => ({
          ...prev,
          [smsModal.studentId]: result.sentAt!,
        }));
      }
      toast({ title: "SMS yuborildi! ✓" });
      setSmsModal((prev) => ({ ...prev, open: false }));
      await refreshAll();
    } catch (err) {
      toast({
        title: "SMS yuborishda xatolik",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  const sendOverdueBulkSms = async () => {
    if (overdueRows.length === 0) return;

    setIsSendingSms(true);
    try {
      for (const row of overdueRows) {
        await smsAPI.send({
          studentId: row.studentId,
          parentPhone: row.parentPhone,
          message: buildSmsText({
            parentName: row.parentName,
            studentName: row.fullName,
            billingMonth: toMonthValue(row.billingMonth),
            amount: row.monthlyFee,
          }),
          type: "PAYMENT_REMINDER",
        });
      }
      toast({ title: "Qarzdorlarga SMS yuborildi!" });
      await refreshAll();
    } catch (err) {
      toast({
        title: "SMS yuborishda xatolik",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  const openHistory = async (item: PaymentView) => {
    const studentName =
      `${item.student.firstName} ${item.student.lastName}`.trim();
    setHistoryModal({ open: true, studentName, loading: true, rows: [] });
    try {
      const response = await smsAPI.history({
        studentId: item.student.id,
        limit: 50,
      });
      setHistoryModal((prev) => ({
        ...prev,
        rows: extractList<SmsHistoryItem>(response, ["history"]),
      }));
    } finally {
      setHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const paidThisMonth = useMemo(
    () => payments.filter((item) => item.status === "PAID"),
    [payments],
  );
  const debtorsThisMonth = useMemo(
    () => payments.filter((item) => item.status !== "PAID"),
    [payments],
  );

  const showOverdueBanner = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const isCurrentMonth = selectedMonth === toMonthValue(toYMD(new Date()));
    return day > 15 && isCurrentMonth && overdueRows.length > 0;
  }, [overdueRows.length, selectedMonth]);

  if (!canAccess) return null;

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader title="To'lovlar" />

      <div className="w-full space-y-4 px-4 py-4 sm:space-y-6 sm:p-6">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {showOverdueBanner ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="flex flex-col items-start justify-between gap-2 sm:gap-3 p-4 sm:flex-row sm:items-center">
              <p className="text-xs sm:text-sm text-destructive">
                ⚠️ {overdueRows.length} ta o'quvchi {monthLabel(selectedMonth)}{" "}
                oyi uchun to'lov qilmagan! Ota-onalarga SMS yuborish
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                onClick={sendOverdueBulkSms}
                disabled={isSendingSms}
              >
                SMS yuborish
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Filterlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 pb-4 sm:px-6 sm:pb-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Guruh</Label>
              <Select
                value={selectedGroupId}
                onValueChange={(value) => updateFilters({ groupId: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Guruh" />
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

            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Oy</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  updateFilters({ month: event.target.value })
                }
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">Holat</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => updateFilters({ status: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Holat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="PAID">To'langan</SelectItem>
                  <SelectItem value="UNPAID">To'lanmagan</SelectItem>
                  <SelectItem value="PARTIAL">Qisman</SelectItem>
                  <SelectItem value="OVERDUE">Kechikkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kim to'lagan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {paidThisMonth.length === 0 ? (
                <p className="text-muted-foreground">
                  Ushbu oyda to'lov qilganlar yo'q
                </p>
              ) : (
                paidThisMonth.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <span>
                      {`${item.student.firstName} ${item.student.lastName}`.trim()}
                    </span>
                    {canViewAmounts ? (
                      <span>{formatCurrency(item.paidAmount)}</span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kim qarzdor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {debtorsThisMonth.length === 0 ? (
                <p className="text-muted-foreground">Qarzdorlar yo'q</p>
              ) : (
                debtorsThisMonth.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <span>
                      {`${item.student.firstName} ${item.student.lastName}`.trim()}
                    </span>
                    {canViewAmounts ? (
                      <span className="text-destructive">
                        {formatCurrency(
                          Math.max(
                            0,
                            (item.amount || 0) - (item.paidAmount || 0),
                          ),
                        )}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <Button variant="outline" onClick={openCreateModal} className="w-full sm:w-auto">
            + To'lov qo'shish
          </Button>
          <Button variant="outline" onClick={startGroupFlow} className="w-full sm:w-auto">
            + Guruh to'lovi
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O'quvchi</TableHead>
                  <TableHead>Guruh</TableHead>
                  <TableHead>Oy</TableHead>
                  {canViewAmounts ? <TableHead>Amount</TableHead> : null}
                  {canViewAmounts ? <TableHead>Paid</TableHead> : null}
                  {canViewAmounts ? <TableHead>Debt</TableHead> : null}
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((item) => {
                  const studentName =
                    `${item.student.firstName} ${item.student.lastName}`.trim();
                  const isOverdue =
                    item.status === "OVERDUE" || item.status === "UNPAID";

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => openHistory(item)}
                        >
                          {studentName}
                        </button>
                      </TableCell>
                      <TableCell>{item.group.name}</TableCell>
                      <TableCell>{toMonthValue(item.billingMonth)}</TableCell>
                      {canViewAmounts ? (
                        <TableCell>{formatCurrency(item.amount)}</TableCell>
                      ) : null}
                      {canViewAmounts ? (
                        <TableCell>{formatCurrency(item.paidAmount)}</TableCell>
                      ) : null}
                      {canViewAmounts ? (
                        <TableCell className="text-destructive">
                          {formatCurrency(
                            Math.max(
                              0,
                              (item.amount || 0) - (item.paidAmount || 0),
                            ),
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <StatusBadge status={statusForBadge(item.status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {smsSentAtMap[item.student.id] ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                              SMS yuborildi{" "}
                              {new Date(
                                smsSentAtMap[item.student.id],
                              ).toLocaleTimeString("uz-UZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil className="mr-1 size-3" /> Tahrirlash
                          </Button>
                          {isOverdue ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => openSmsForPayment(item)}
                            >
                              📱 SMS
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-md rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {paymentForm.id ? "To'lovni tahrirlash" : "To'lov qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!paymentForm.id ? (
              <>
                <div className="space-y-1">
                  <Label>Guruh</Label>
                  <Select
                    value={paymentForm.groupId}
                    onValueChange={async (value) => {
                      setPaymentForm((prev) => ({
                        ...prev,
                        groupId: value,
                        studentId: "",
                      }));
                      const studentsData = await studentsAPI.list({
                        groupId: value,
                      });
                      setFormStudents(
                        extractList<StudentItem>(studentsData, ["students"]),
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Guruhni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name || group.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>O'quvchi</Label>
                  <Select
                    value={paymentForm.studentId}
                    onValueChange={(value) =>
                      setPaymentForm((prev) => ({ ...prev, studentId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="O'quvchini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {formStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
                            student.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Oy</Label>
                  <Input
                    type="month"
                    value={toMonthValue(paymentForm.billingMonth)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        billingMonth: `${event.target.value}-01`,
                      }))
                    }
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <Label>Holat</Label>
              <Select
                value={paymentForm.status}
                onValueChange={(value) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    status: parseStatus(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Holat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">To'langan</SelectItem>
                  <SelectItem value="UNPAID">To'lanmagan</SelectItem>
                  <SelectItem value="PARTIAL">Qisman</SelectItem>
                  <SelectItem value="OVERDUE">Kechikkan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canViewAmounts ? (
              <>
                <div className="space-y-1">
                  <Label>Amount</Label>
                  <Input
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Paid amount</Label>
                  <Input
                    value={paymentForm.paidAmount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paidAmount: event.target.value,
                      }))
                    }
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <Label>Izoh</Label>
              <Textarea
                rows={3}
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={saveEditPayment} disabled={isSaving}>
              {isSaving ? (
                <CircleAlert className="mr-2 size-4 animate-spin" />
              ) : null}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-4xl rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Guruh to'lovi</DialogTitle>
            <DialogDescription>
              {groupStep === 1
                ? "1-bosqich: guruh va oy tanlash"
                : "2-bosqich: o'quvchilar to'lovi"}
            </DialogDescription>
          </DialogHeader>

          {groupStep === 1 ? (
            <div className="grid gap-3 py-2 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Guruh</Label>
                <Select
                  value={groupFlow.groupId}
                  onValueChange={(value) =>
                    setGroupFlow((prev) => ({ ...prev, groupId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name || group.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Oy</Label>
                <Input
                  type="month"
                  value={groupFlow.billingMonth}
                  onChange={(event) =>
                    setGroupFlow((prev) => ({
                      ...prev,
                      billingMonth: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Oylik to'lov</Label>
                <Input
                  value={groupFlow.monthlyFee}
                  onChange={(event) =>
                    setGroupFlow((prev) => ({
                      ...prev,
                      monthlyFee: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Guruhdagi barcha o'quvchilar
                </p>
                <Button variant="outline" onClick={markAllPaid}>
                  Hammasini to'langan deb belgilash
                </Button>
              </div>

              <div className="max-h-90 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>To'landi</TableHead>
                      <TableHead>O'quvchi ismi</TableHead>
                      <TableHead>Telefon</TableHead>
                      {canViewAmounts ? <TableHead>To'landi</TableHead> : null}
                      {canViewAmounts ? <TableHead>Qarzdor</TableHead> : null}
                      <TableHead>Holat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.map((row) => (
                      <TableRow key={row.studentId}>
                        <TableCell>
                          <Checkbox
                            checked={row.paid}
                            onCheckedChange={(checked) => {
                              const amount =
                                normalizeMoney(groupFlow.monthlyFee) ||
                                row.amount;
                              setGroupRows((prev) =>
                                prev.map((item) =>
                                  item.studentId === row.studentId
                                    ? {
                                        ...item,
                                        paid: Boolean(checked),
                                        paidAmount: Boolean(checked)
                                          ? amount
                                          : 0,
                                        status: Boolean(checked)
                                          ? "PAID"
                                          : "UNPAID",
                                      }
                                    : item,
                                ),
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>{row.studentName}</TableCell>
                        <TableCell>{row.phone || "-"}</TableCell>
                        {canViewAmounts ? (
                          <TableCell>
                            <Input
                              disabled={!row.paid}
                              value={String(row.paidAmount)}
                              onChange={(event) => {
                                const value = normalizeMoney(
                                  event.target.value,
                                );
                                setGroupRows((prev) =>
                                  prev.map((item) =>
                                    item.studentId === row.studentId
                                      ? {
                                          ...item,
                                          paidAmount: value,
                                          status:
                                            value >= item.amount
                                              ? "PAID"
                                              : value > 0
                                                ? "PARTIAL"
                                                : "UNPAID",
                                          paid: value > 0,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </TableCell>
                        ) : null}
                        {canViewAmounts ? (
                          <TableCell className="text-destructive">
                            {formatCurrency(
                              Math.max(0, row.amount - row.paidAmount),
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <StatusBadge status={statusForBadge(row.status)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {groupStep === 2 ? (
              <Button variant="outline" onClick={() => setGroupStep(1)}>
                Orqaga
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setGroupModalOpen(false)}>
              Bekor qilish
            </Button>
            {groupStep === 1 ? (
              <Button
                onClick={loadGroupPaymentRows}
                disabled={!groupFlow.groupId || isLoadingGroupRows}
              >
                {isLoadingGroupRows ? "Yuklanmoqda..." : "Davom etish"}
              </Button>
            ) : (
              <Button onClick={saveGroupPayments} disabled={isSaving}>
                {isSaving ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={smsModal.open}
        onOpenChange={(open) => setSmsModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>SMS yuborish - {smsModal.studentName}</DialogTitle>
            <DialogDescription>
              Xabar uzunligi: {smsModal.message.length}/160
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Kimga</Label>
              <Input
                value={smsModal.parentPhone}
                onChange={(event) =>
                  setSmsModal((prev) => ({
                    ...prev,
                    parentPhone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Xabar</Label>
              <Textarea
                maxLength={160}
                rows={6}
                value={smsModal.message}
                onChange={(event) =>
                  setSmsModal((prev) => ({
                    ...prev,
                    message: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSmsModal((prev) => ({ ...prev, open: false }))}
            >
              Bekor qilish
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={sendSingleSms}
              disabled={isSendingSms}
            >
              {isSendingSms ? "Yuborilmoqda..." : "Yuborish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyModal.open}
        onOpenChange={(open) => setHistoryModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-xl rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>SMS tarixi - {historyModal.studentName}</DialogTitle>
          </DialogHeader>

          {historyModal.loading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : historyModal.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              SMS tarixi topilmadi
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {historyModal.rows.map((row) => (
                <div key={row.id} className="rounded border p-2 text-sm">
                  <p className="font-medium">
                    {new Date(row.sentAt).toLocaleString("uz-UZ")}
                  </p>
                  <p className="text-muted-foreground">{row.parentPhone}</p>
                  <p>{row.message}</p>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setHistoryModal((prev) => ({ ...prev, open: false }))
              }
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
