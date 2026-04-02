import { PaymentStatus, Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import {
  assertValidPaymentAmounts,
  calculatePaymentStatus,
  getPaymentDueDate,
  normalizeBillingMonth,
} from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const bulkPaymentItemSchema = z.object({
  studentId: z.string().cuid(),
  amount: z.coerce.number().positive(),
  paidAmount: z.coerce.number().min(0).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const bulkPaymentSchema = z.object({
  groupId: z.string().cuid(),
  billingMonth: z.string().date(),
  payments: z.array(bulkPaymentItemSchema).min(1),
});

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const body = await parseJson(request, bulkPaymentSchema);
    const billingMonth = normalizeBillingMonth(body.billingMonth);
    const dueDate = getPaymentDueDate(billingMonth);

    const memberships = await db.groupStudent.findMany({
      where: {
        groupId: body.groupId,
        leftAt: null,
      },
      select: {
        studentId: true,
      },
    });

    const allowedStudentIds = new Set(
      memberships.map((item) => item.studentId),
    );

    for (const payment of body.payments) {
      if (!allowedStudentIds.has(payment.studentId)) {
        return jsonError(
          400,
          "Ba'zi o'quvchilar tanlangan guruhga tegishli emas",
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const results = [];

      for (const item of body.payments) {
        const paidAmount =
          item.paidAmount !== undefined
            ? item.paidAmount
            : item.status === PaymentStatus.PAID
              ? item.amount
              : 0;

        if (paidAmount > item.amount) {
          throw new Error("Paid amount cannot be greater than amount");
        }

        assertValidPaymentAmounts(item.amount, paidAmount);
        const status = calculatePaymentStatus({
          amount: item.amount,
          paidAmount,
          dueDate,
        });

        const payment = await tx.payment.upsert({
          where: {
            studentId_groupId_billingMonth: {
              studentId: item.studentId,
              groupId: body.groupId,
              billingMonth,
            },
          },
          update: {
            amount: new Prisma.Decimal(item.amount),
            paidAmount: new Prisma.Decimal(paidAmount),
            status,
            dueDate,
            notes: item.notes ?? null,
            paidAt: paidAmount > 0 ? new Date() : null,
          },
          create: {
            studentId: item.studentId,
            groupId: body.groupId,
            billingMonth,
            dueDate,
            amount: new Prisma.Decimal(item.amount),
            paidAmount: new Prisma.Decimal(paidAmount),
            status,
            notes: item.notes ?? null,
            paidAt: paidAmount > 0 ? new Date() : null,
          },
          select: {
            id: true,
            studentId: true,
            status: true,
            amount: true,
            paidAmount: true,
          },
        });

        results.push(payment);
      }

      return results;
    });

    return jsonSuccess(
      {
        groupId: body.groupId,
        billingMonth,
        count: updated.length,
        payments: updated,
      },
      "To'lovlar saqlandi!",
    );
  } catch (error) {
    return handleApiError(error, "Payments bulk API error");
  }
}
