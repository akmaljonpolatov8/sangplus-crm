"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRole, hasAccess } from "@/lib-frontend/role-context";
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
  CreditCard,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";

type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";

interface Payment {
  id: string;
  student: string;
  group: string;
  month: string;
  amount: string;
  status: PaymentStatus;
  paidDate: string | null;
  parentPhone: string;
}

const mockPayments: Payment[] = [
  {
    id: "1",
    student: "Aziza Karimova",
    group: "Kimyo 101",
    month: "Mart 2026",
    amount: "350,000",
    status: "paid",
    paidDate: "2026-03-10",
    parentPhone: "+998 90 444 55 66",
  },
  {
    id: "2",
    student: "Bobur Aliyev",
    group: "Biologiya 201",
    month: "Mart 2026",
    amount: "300,000",
    status: "paid",
    paidDate: "2026-03-12",
    parentPhone: "+998 91 555 66 77",
  },
  {
    id: "3",
    student: "Jasur Toshmatov",
    group: "Kimyo 101",
    month: "Mart 2026",
    amount: "350,000",
    status: "overdue",
    paidDate: null,
    parentPhone: "+998 93 666 77 88",
  },
  {
    id: "4",
    student: "Malika Rahimova",
    group: "Biologiya 201",
    month: "Mart 2026",
    amount: "300,000",
    status: "partial",
    paidDate: "2026-03-14",
    parentPhone: "+998 94 777 88 99",
  },
  {
    id: "5",
    student: "Sardor Umarov",
    group: "Kimyo 102",
    month: "Mart 2026",
    amount: "350,000",
    status: "overdue",
    paidDate: null,
    parentPhone: "+998 95 888 99 00",
  },
  {
    id: "6",
    student: "Dilnoza Yusupova",
    group: "Biologiya 202",
    month: "Mart 2026",
    amount: "300,000",
    status: "paid",
    paidDate: "2026-03-08",
    parentPhone: "+998 97 999 00 11",
  },
  {
    id: "7",
    student: "Akmal Nazarov",
    group: "Kimyo 102",
    month: "Mart 2026",
    amount: "350,000",
    status: "unpaid",
    paidDate: null,
    parentPhone: "+998 99 000 11 22",
  },
  {
    id: "8",
    student: "Kamola Abdullayeva",
    group: "Kimyo 101",
    month: "Mart 2026",
    amount: "350,000",
    status: "paid",
    paidDate: "2026-03-15",
    parentPhone: "+998 90 111 22 33",
  },
];

const defaultReminderMessage = `Hurmatli ota-ona, SangPlus o'quv markazidan eslatma. Farzandingiz bo'yicha to'lov kechiktirilgan. To'lovni imkon qadar tezroq amalga oshirishingizni so'raymiz.`;

export default function PaymentsPage() {
  const router = useRouter();
  const { role } = useRole();
  const [payments] = useState<Payment[]>(mockPayments);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reminderMessage, setReminderMessage] = useState(
    defaultReminderMessage,
  );

  // Check if user can access this page
  const canAccessPayments = hasAccess(role, "payments");
  const canViewAmounts = hasAccess(role, "payments-amounts");

  // Redirect if no access
  useEffect(() => {
    if (!canAccessPayments) {
      router.replace("/dashboard/attendance");
    }
  }, [canAccessPayments, router]);

  if (!canAccessPayments) {
    return null;
  }

  const filteredPayments =
    statusFilter === "all"
      ? payments
      : payments.filter((p) => p.status === statusFilter);

  const stats = {
    total: payments.reduce(
      (sum, p) => sum + parseInt(p.amount.replace(/,/g, "")),
      0,
    ),
    paid: payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + parseInt(p.amount.replace(/,/g, "")), 0),
    unpaid: payments
      .filter((p) => p.status === "unpaid" || p.status === "overdue")
      .reduce((sum, p) => sum + parseInt(p.amount.replace(/,/g, "")), 0),
    overdue: payments.filter((p) => p.status === "overdue").length,
    paidCount: payments.filter((p) => p.status === "paid").length,
    unpaidCount: payments.filter(
      (p) => p.status === "unpaid" || p.status === "overdue",
    ).length,
  };

  const handleSendReminder = (payment: Payment) => {
    setSelectedPayment(payment);
    setReminderMessage(defaultReminderMessage);
    setIsReminderOpen(true);
  };

  const handleConfirmReminder = () => {
    // Send reminder logic would go here
    alert(`Eslatma yuborildi: ${selectedPayment?.parentPhone}`);
    setIsReminderOpen(false);
  };

  // Define columns based on role
  const columns = [
    {
      key: "student",
      header: "O'quvchi",
      render: (payment: Payment) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-chart-2/20 text-sm font-medium text-chart-2">
            {payment.student
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <span className="font-medium text-foreground">{payment.student}</span>
        </div>
      ),
    },
    {
      key: "group",
      header: "Guruh",
      render: (payment: Payment) => (
        <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
          {payment.group}
        </span>
      ),
    },
    {
      key: "month",
      header: "Oy",
      render: (payment: Payment) => (
        <span className="text-muted-foreground">{payment.month}</span>
      ),
    },
    // Only show amount column for owner
    ...(canViewAmounts
      ? [
          {
            key: "amount",
            header: "Summa",
            render: (payment: Payment) => (
              <span className="font-medium text-foreground">
                {payment.amount} so&apos;m
              </span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "To'lov holati",
      render: (payment: Payment) => <StatusBadge status={payment.status} />,
    },
    {
      key: "paidDate",
      header: "To'langan sana",
      render: (payment: Payment) => (
        <span className="text-muted-foreground">
          {payment.paidDate
            ? new Date(payment.paidDate).toLocaleDateString("uz-UZ")
            : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (payment: Payment) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canViewAmounts && (
                <DropdownMenuItem>
                  <CreditCard className="mr-2 size-4" />
                  To&apos;lovni belgilash
                </DropdownMenuItem>
              )}
              {(payment.status === "unpaid" ||
                payment.status === "overdue") && (
                <DropdownMenuItem onClick={() => handleSendReminder(payment)}>
                  <MessageSquare className="mr-2 size-4" />
                  Eslatma yuborish
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <DashboardHeader title="To'lovlar" />

      <div className="p-6 space-y-6">
        {/* Stats - Different view for owner vs manager */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canViewAmounts ? (
            // Owner view - with amounts
            <>
              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                      <CreditCard className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Jami to&apos;lov
                      </p>
                      <p className="text-xl font-semibold text-foreground">
                        {stats.total.toLocaleString()} so&apos;m
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-success/10">
                      <CheckCircle className="size-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        To&apos;langan
                      </p>
                      <p className="text-xl font-semibold text-success">
                        {stats.paid.toLocaleString()} so&apos;m
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
                      <AlertCircle className="size-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        To&apos;lanmagan
                      </p>
                      <p className="text-xl font-semibold text-destructive">
                        {stats.unpaid.toLocaleString()} so&apos;m
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-warning/10">
                      <AlertCircle className="size-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Kechikkanlar
                      </p>
                      <p className="text-xl font-semibold text-warning">
                        {stats.overdue} ta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            // Manager view - only counts, no amounts
            <>
              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                      <Eye className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Jami o&apos;quvchilar
                      </p>
                      <p className="text-xl font-semibold text-foreground">
                        {payments.length} ta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-success/10">
                      <CheckCircle className="size-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        To&apos;lagan
                      </p>
                      <p className="text-xl font-semibold text-success">
                        {stats.paidCount} ta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
                      <AlertCircle className="size-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        To&apos;lamagan
                      </p>
                      <p className="text-xl font-semibold text-destructive">
                        {stats.unpaidCount} ta
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-warning/10">
                      <EyeOff className="size-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Summalar</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        Faqat egasi ko&apos;radi
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-secondary/50 border-transparent">
              <SelectValue placeholder="Holat bo'yicha filtrlash" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="paid">To&apos;langan</SelectItem>
              <SelectItem value="unpaid">To&apos;lanmagan</SelectItem>
              <SelectItem value="partial">Qisman</SelectItem>
              <SelectItem value="overdue">Kechikkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable
          data={filteredPayments}
          columns={columns}
          searchPlaceholder="O'quvchi qidirish..."
          showFilters={false}
        />

        {/* Reminder Message Preview Card */}
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-4">
            <MessageSquare className="size-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Eslatma xabari namunasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-secondary/30 p-4">
              <p className="text-sm leading-relaxed text-foreground">
                {defaultReminderMessage}
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              * Bu xabar to&apos;lov kechikkan o&apos;quvchilarning
              ota-onalariga yuboriladi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reminder Dialog */}
      <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Eslatma yuborish</DialogTitle>
            <DialogDescription>
              {selectedPayment?.student} ning ota-onasiga eslatma xabari
              yuboriladi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-xl bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">O&apos;quvchi:</span>
                <span className="font-medium text-foreground">
                  {selectedPayment?.student}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Telefon:</span>
                <span className="font-medium text-foreground">
                  {selectedPayment?.parentPhone}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Guruh:</span>
                <span className="font-medium text-foreground">
                  {selectedPayment?.group}
                </span>
              </div>
              {canViewAmounts && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Summa:</span>
                  <span className="font-medium text-destructive">
                    {selectedPayment?.amount} so&apos;m
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Xabar matni</Label>
              <Textarea
                id="message"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                className="min-h-[120px] bg-secondary/50 border-transparent resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReminderOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleConfirmReminder} className="gap-2">
              <Send className="size-4" />
              Yuborish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
