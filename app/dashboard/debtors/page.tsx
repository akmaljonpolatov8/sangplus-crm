"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareMore } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  smsSentToday?: boolean;
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
  studentId: string;
  studentName: string;
  parentPhone: string;
  message: string;
}

const CENTER_PHONE = process.env.NEXT_PUBLIC_CENTER_PHONE || "+998900000000";

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
  const currentMonthLabel = formatMonthLabel(new Date().toISOString());
  const amountLabel =
    item.amount != null
      ? formatCurrency(item.amount).replace(" so'm", "")
      : "belgilangan";

  return `Assalomu alaykum, ${parentName}!\nFarzandingiz ${item.studentName}ning ${billingMonthLabel} oyi uchun ${amountLabel} so'm to'lovi amalga oshirilmagan.\nIltimos, to'lovni ${currentMonthLabel} oyining oxirigacha amalga oshiring.\nSangPlus o'quv markazi. Tel: ${CENTER_PHONE}`.slice(
    0,
    160,
  );
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
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [smsModal, setSmsModal] = useState<SmsModalState>({
    isOpen: false,
    studentId: "",
    studentName: "",
    parentPhone: "",
    message: "",
  });

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [historyModal, setHistoryModal] = useState({
    open: false,
    studentName: "",
    rows: [] as SmsHistoryItem[],
    loading: false,
  });

  const [sentAtMap, setSentAtMap] = useState<Record<string, string>>({});

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
      setDebtors(extractList<DebtorItem>(debtorsData, ["debtors"]));
      setSelectedStudentIds([]);
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

  const selectedRows = useMemo(
    () =>
      filtered.filter((item) => selectedStudentIds.includes(item.studentId)),
    [filtered, selectedStudentIds],
  );

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) =>
      checked
        ? [...new Set([...prev, studentId])]
        : prev.filter((id) => id !== studentId),
    );
  };

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedStudentIds([]);
      return;
    }
    setSelectedStudentIds(filtered.map((item) => item.studentId));
  };

  const openSmsModal = (item: DebtorItem) => {
    setSmsModal({
      isOpen: true,
      studentId: item.studentId,
      studentName: item.studentName,
      parentPhone: item.parentPhone || "",
      message: buildSmsTemplate(item),
    });
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
      })) as { sentAt?: string };

      toast({ title: "SMS yuborildi! ✓" });
      if (result?.sentAt) {
        setSentAtMap((prev) => ({
          ...prev,
          [smsModal.studentId]: result.sentAt!,
        }));
      }
      setSmsModal((prev) => ({ ...prev, isOpen: false }));
      await load();
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

  const sendBulkSms = async () => {
    if (selectedRows.length === 0) return;

    setIsSendingSms(true);
    setBulkProgress({ done: 0, total: selectedRows.length });

    try {
      for (let index = 0; index < selectedRows.length; index += 1) {
        const item = selectedRows[index];
        const result = (await smsAPI.send({
          studentId: item.studentId,
          parentPhone: item.parentPhone || "",
          message: buildSmsTemplate(item),
          type: "PAYMENT_REMINDER",
        })) as { sentAt?: string };

        if (result?.sentAt) {
          setSentAtMap((prev) => ({
            ...prev,
            [item.studentId]: result.sentAt!,
          }));
        }

        setBulkProgress({ done: index + 1, total: selectedRows.length });
      }

      toast({ title: "Tanlanganlarga SMS yuborildi!" });
      setBulkModalOpen(false);
      await load();
    } catch (err) {
      toast({
        title: "Bulk SMS yuborishda xatolik",
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

  const allChecked =
    filtered.length > 0 && selectedStudentIds.length === filtered.length;

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

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Tanlanganlar: {selectedStudentIds.length}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={selectedStudentIds.length === 0 || isSendingSms}
            onClick={() => setBulkModalOpen(true)}
          >
            Tanlanganlarga SMS yuborish
          </Button>
        </div>

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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAllVisible(Boolean(v))}
                    />
                  </TableHead>
                  <TableHead>O'quvchi ismi</TableHead>
                  <TableHead>Guruh</TableHead>
                  <TableHead>Ota-ona telefoni</TableHead>
                  {canViewAmounts ? (
                    <TableHead>Qarzdorlik miqdori</TableHead>
                  ) : null}
                  <TableHead>Qarzdorlik muddati</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.paymentId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStudentIds.includes(item.studentId)}
                        onCheckedChange={(v) =>
                          toggleStudent(item.studentId, Boolean(v))
                        }
                      />
                    </TableCell>
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
                    <TableCell className="text-destructive">
                      {item.daysOverdue} kun
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.smsSentToday || sentAtMap[item.studentId] ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                            <MessageSquareMore className="size-3" />
                            SMS yuborildi{" "}
                            {sentAtMap[item.studentId]
                              ? new Date(
                                  sentAtMap[item.studentId],
                                ).toLocaleTimeString("uz-UZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "bugun"}
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => openSmsModal(item)}
                        >
                          SMS
                        </Button>
                      </div>
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
              Xabar uzunligi: {smsModal.message.length}/160
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
                maxLength={160}
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

      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk SMS yuborish</DialogTitle>
            <DialogDescription>
              {selectedRows.length} ta ota-onaga SMS yuboriladi
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {isSendingSms
              ? `${bulkProgress.done} / ${bulkProgress.total} yuborildi`
              : "Tasdiqlasangiz yuborish boshlanadi."}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkModalOpen(false)}
              disabled={isSendingSms}
            >
              Bekor qilish
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={sendBulkSms}
              disabled={isSendingSms || selectedRows.length === 0}
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
