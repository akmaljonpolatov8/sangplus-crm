"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareMore } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  paymentsAPI,
  smsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency } from "@/lib-frontend/utils";
import { toast } from "@/hooks/use-toast";

interface GroupItem {
  id: string;
  name?: string;
}

interface DebtorItem {
  paymentId: string;
  studentId: string;
  studentName: string;
  parentName?: string | null;
  phone?: string | null;
  parentPhone?: string | null;
  groupId: string;
  groupName: string;
  billingMonth: string;
  dueDate: string;
  daysOverdue: number;
  smsSentThisMonth?: boolean;
  smsLastSentAt?: string | null;
  amount?: number;
}

interface SmsHistoryItem {
  id: string;
  message: string;
  parentPhone: string;
  type: string;
  status: string;
  sentAt: string;
}

interface SmsModalState {
  isOpen: boolean;
  forceResend: boolean;
  month: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  message: string;
}

interface ResendConfirmState {
  isOpen: boolean;
  item: DebtorItem | null;
}

function formatMonthLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "joriy";
  return date.toLocaleDateString("uz-UZ", {
    month: "long",
    year: "numeric",
  });
}

function buildSmsTemplate(item: DebtorItem): string {
  const parentName = item.parentName?.trim() || "ota-ona";
  const billingMonthLabel = formatMonthLabel(item.billingMonth);
  const amountLabel =
    item.amount != null
      ? formatCurrency(item.amount).replace(" so'm", "")
      : "belgilangan";

  return `Hurmatli ${parentName}! Farzandingiz ${item.studentName}ning ${billingMonthLabel} oyi uchun ${amountLabel} so'm to'lovi amalga oshirilmagan. Iltimos to'lovni amalga oshiring. SangPlus o'quv markazi.`;
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
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [smsModal, setSmsModal] = useState<SmsModalState>({
    isOpen: false,
    forceResend: false,
    month: new Date().toISOString(),
    studentId: "",
    studentName: "",
    parentPhone: "",
    message: "",
  });

  const [resendConfirm, setResendConfirm] = useState<ResendConfirmState>({
    isOpen: false,
    item: null,
  });

  const [historyModal, setHistoryModal] = useState({
    open: false,
    studentName: "",
    rows: [] as SmsHistoryItem[],
    loading: false,
  });

  const [sentAtMap, setSentAtMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
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
      setDebtors(extractList<DebtorItem>(debtorsData, ["debtors"]));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    load();
  }, [canAccess, load, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...debtors].sort(
      (a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0),
    );

    if (!query) return sorted;

    return sorted.filter((item) =>
      [item.studentName, item.phone, item.parentPhone, item.groupName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [debtors, search]);

  const openSmsModal = (item: DebtorItem, forceResend: boolean) => {
    setSmsModal({
      isOpen: true,
      forceResend,
      month: item.billingMonth,
      studentId: item.studentId,
      studentName: item.studentName,
      parentPhone: item.parentPhone || "",
      message: buildSmsTemplate(item),
    });
  };

  const handleOpenSms = (item: DebtorItem) => {
    if (item.smsSentThisMonth || sentAtMap[item.studentId]) {
      setResendConfirm({
        isOpen: true,
        item,
      });
      return;
    }

    openSmsModal(item, false);
  };

  const sendSms = async () => {
    if (!smsModal.studentId) return;

    setIsSendingSms(true);
    try {
      const result = (await smsAPI.send({
        studentId: smsModal.studentId,
        parentPhone: smsModal.parentPhone.trim(),
        message: smsModal.message.trim(),
        type: "PAYMENT_REMINDER",
        month: smsModal.month,
        forceResend: smsModal.forceResend,
      })) as { sentAt?: string };

      toast({ title: "SMS yuborildi! ✓" });
      if (result?.sentAt) {
        setSentAtMap((prev) => ({
          ...prev,
          [smsModal.studentId]: result.sentAt!,
        }));
      }
      setSmsModal((prev) => ({ ...prev, isOpen: false }));
      setResendConfirm({ isOpen: false, item: null });
      await load();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const modalItem = debtors.find(
          (item) => item.studentId === smsModal.studentId,
        );
        if (modalItem) {
          setResendConfirm({
            isOpen: true,
            item: modalItem,
          });
        }
      }
      toast({
        title: "SMS yuborishda xatolik",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  const openSmsHistory = async (item: DebtorItem) => {
    setHistoryModal({
      open: true,
      studentName: item.studentName,
      rows: [],
      loading: true,
    });
    try {
      const response = await smsAPI.history({
        studentId: item.studentId,
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
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Qarzdorlar topilmadi
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O&apos;quvchi ismi</TableHead>
                  <TableHead>Guruh</TableHead>
                  <TableHead>Ota-ona telefoni</TableHead>
                  {canViewAmounts ? (
                    <TableHead>Oylik to&apos;lov</TableHead>
                  ) : null}
                  <TableHead>SMS holati</TableHead>
                  <TableHead className="text-right">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.paymentId}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => openSmsHistory(item)}
                      >
                        {item.studentName}
                      </button>
                    </TableCell>
                    <TableCell>{item.groupName}</TableCell>
                    <TableCell>
                      {item.parentPhone ? (
                        <a
                          href={`tel:${item.parentPhone}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {item.parentPhone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    {canViewAmounts ? (
                      <TableCell className="text-destructive">
                        {item.amount == null
                          ? "-"
                          : formatCurrency(item.amount)}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {item.smsSentThisMonth || sentAtMap[item.studentId] ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                          <MessageSquareMore className="size-3" />
                          Yuborildi{" "}
                          {new Date(
                            sentAtMap[item.studentId] ||
                              item.smsLastSentAt ||
                              "",
                          ).toLocaleDateString("uz-UZ")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-600">
                          Yuborilmagan
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        className={
                          item.smsSentThisMonth || sentAtMap[item.studentId]
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }
                        onClick={() => handleOpenSms(item)}
                      >
                        {item.smsSentThisMonth || sentAtMap[item.studentId]
                          ? "Qayta yuborish"
                          : "SMS yuborish"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={smsModal.isOpen}
        onOpenChange={(open) =>
          setSmsModal((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>SMS yuborish - {smsModal.studentName}</DialogTitle>
            <DialogDescription>
              To: {smsModal.parentPhone || "raqam kiritilmagan"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="sms-phone">Kimga</Label>
              <Input
                id="sms-phone"
                placeholder="+998XXXXXXXXX"
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
              <Label htmlFor="sms-message">Xabar matni</Label>
              <Textarea
                id="sms-message"
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
              onClick={() =>
                setSmsModal((prev) => ({ ...prev, isOpen: false }))
              }
              disabled={isSendingSms}
            >
              Bekor qilish
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={sendSms}
              disabled={isSendingSms}
            >
              {isSendingSms ? "Yuborilmoqda..." : "Yuborish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resendConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setResendConfirm({ isOpen: false, item: null });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Qayta yuborishni tasdiqlang</DialogTitle>
            <DialogDescription>
              Bu ota-onaga{" "}
              {resendConfirm.item?.smsLastSentAt
                ? new Date(resendConfirm.item.smsLastSentAt).toLocaleDateString(
                    "uz-UZ",
                  )
                : "shu oy"}{" "}
              da SMS yuborilgan. Qayta yubormoqchimisiz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResendConfirm({ isOpen: false, item: null })}
              disabled={isSendingSms}
            >
              Bekor qilish
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                if (!resendConfirm.item) return;
                openSmsModal(resendConfirm.item, true);
                setResendConfirm({ isOpen: false, item: null });
              }}
              disabled={isSendingSms || !resendConfirm.item}
            >
              Ha, qayta yuborish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyModal.open}
        onOpenChange={(open) => setHistoryModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-xl">
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
