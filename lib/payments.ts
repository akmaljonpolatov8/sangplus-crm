import { PaymentStatus } from "@prisma/client";

export function normalizeBillingMonth(value: string | Date) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function getBillingMonthEnd(value: string | Date) {
  const month = normalizeBillingMonth(value);
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
}

export function getPaymentDueDate(billingMonth: string | Date) {
  const month = normalizeBillingMonth(billingMonth);
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 15));
}

export function calculatePaymentStatus(input: {
  amount: number;
  paidAmount?: number | null;
  dueDate: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const paidAmount = input.paidAmount ?? 0;

  if (paidAmount >= input.amount) {
    return PaymentStatus.PAID;
  }

  if (paidAmount > 0) {
    return PaymentStatus.PARTIAL;
  }

  if (now > input.dueDate) {
    return PaymentStatus.OVERDUE;
  }

  return PaymentStatus.UNPAID;
}

export function buildReminderText(studentName: string, groupName: string) {
  return `Hurmatli ota-ona, SangPlus o'quv markazidan eslatma. ${studentName} (${groupName}) bo'yicha to'lov kechiktirilgan. To'lovni imkon qadar tezroq amalga oshirishingizni so'raymiz.`;
}

export function assertValidPaymentAmounts(amount: number, paidAmount: number) {
  if (paidAmount > amount) {
    throw new Error("Paid amount cannot be greater than the total amount");
  }
}

export function getDebtAmount(amount: number, paidAmount: number) {
  return Math.max(0, amount - paidAmount);
}

export function toNumberAmount(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type PaymentParty = {
  id: string;
  name: string;
};

type PaymentStudent = {
  id: string;
  firstName: string;
  lastName: string;
  parentPhone: string;
};

type PaymentBase = {
  id: string;
  billingMonth: Date;
  dueDate: Date;
  status: PaymentStatus;
  student: PaymentStudent;
  group: PaymentParty;
};

type OwnerPayment = PaymentBase & {
  paidAt: Date | null;
  notes: string | null;
  amount: unknown;
  paidAmount: unknown;
};

export function serializeOwnerPayment(payment: OwnerPayment) {
  const amount = toNumberAmount(payment.amount);
  const paidAmount = toNumberAmount(payment.paidAmount);
  const status = calculatePaymentStatus({
    amount,
    paidAmount,
    dueDate: payment.dueDate,
  });

  return {
    id: payment.id,
    billingMonth: payment.billingMonth,
    dueDate: payment.dueDate,
    status,
    paidAt: payment.paidAt,
    notes: payment.notes,
    amount: payment.amount,
    paidAmount: payment.paidAmount,
    student: payment.student,
    group: payment.group,
    reminderText:
      status === PaymentStatus.OVERDUE
        ? buildReminderText(
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.group.name,
          )
        : null,
  };
}

export function serializeManagerPayment(payment: PaymentBase) {
  const status = calculatePaymentStatus({
    amount: toNumberAmount((payment as { amount?: unknown }).amount, 0),
    paidAmount: toNumberAmount((payment as { paidAmount?: unknown }).paidAmount, 0),
    dueDate: payment.dueDate,
  });

  return {
    id: payment.id,
    billingMonth: payment.billingMonth,
    dueDate: payment.dueDate,
    status,
    student: payment.student,
    group: payment.group,
    reminderText:
      status === PaymentStatus.OVERDUE
        ? buildReminderText(
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.group.name,
          )
        : null,
  };
}
