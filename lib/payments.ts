import { PaymentStatus } from "@prisma/client";

export function normalizeBillingMonth(value: string | Date) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
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
  return {
    id: payment.id,
    billingMonth: payment.billingMonth,
    dueDate: payment.dueDate,
    status: payment.status,
    paidAt: payment.paidAt,
    notes: payment.notes,
    amount: payment.amount,
    paidAmount: payment.paidAmount,
    student: payment.student,
    group: payment.group,
    reminderText:
      payment.status === PaymentStatus.OVERDUE
        ? buildReminderText(
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.group.name,
          )
        : null,
  };
}

export function serializeManagerPayment(payment: PaymentBase) {
  return {
    id: payment.id,
    billingMonth: payment.billingMonth,
    dueDate: payment.dueDate,
    status: payment.status,
    student: payment.student,
    group: payment.group,
    reminderText:
      payment.status === PaymentStatus.OVERDUE
        ? buildReminderText(
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.group.name,
          )
        : null,
  };
}
