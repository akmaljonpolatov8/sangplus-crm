import { PaymentStatus, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import {
  calculatePaymentStatus,
  getBillingMonthEnd,
  getDebtAmount,
  getPaymentDueDate,
  normalizeBillingMonth,
  toNumberAmount,
} from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const summaryQuerySchema = z.object({
  groupId: z.string().cuid(),
  billingMonth: z.string().date(),
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const query = summaryQuerySchema.parse({
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      billingMonth: request.nextUrl.searchParams.get("billingMonth") ?? undefined,
    });

    const billingMonth = normalizeBillingMonth(query.billingMonth);
    const billingMonthEnd = getBillingMonthEnd(billingMonth);
    const dueDate = getPaymentDueDate(billingMonth);

    const group = await db.group.findUnique({
      where: { id: query.groupId },
      select: {
        id: true,
        name: true,
        subject: true,
        monthlyFee: true,
        isActive: true,
      },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    const memberships = await db.groupStudent.findMany({
      where: {
        groupId: query.groupId,
        joinedAt: {
          lte: billingMonthEnd,
        },
        OR: [
          { leftAt: null },
          {
            leftAt: {
              gte: billingMonth,
            },
          },
        ],
        student: {
          status: {
            not: "INACTIVE",
          },
        },
      },
      select: {
        studentId: true,
        joinedAt: true,
        leftAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            parentPhone: true,
            parentName: true,
            status: true,
          },
        },
      },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    });

    const payments = await db.payment.findMany({
      where: {
        groupId: query.groupId,
        billingMonth,
        studentId: {
          in: memberships.map((membership) => membership.studentId),
        },
      },
      select: {
        id: true,
        studentId: true,
        billingMonth: true,
        dueDate: true,
        amount: true,
        paidAmount: true,
        paidAt: true,
        notes: true,
      },
    });

    const paymentByStudentId = new Map(payments.map((payment) => [payment.studentId, payment]));
    const defaultAmount = Number(group.monthlyFee);

    const entries = memberships.map((membership) => {
      const payment = paymentByStudentId.get(membership.studentId);
      const amount = payment ? toNumberAmount(payment.amount, defaultAmount) : defaultAmount;
      const paidAmount = payment ? toNumberAmount(payment.paidAmount, 0) : 0;
      const effectiveDueDate = payment?.dueDate ?? dueDate;
      const status = calculatePaymentStatus({
        amount,
        paidAmount,
        dueDate: effectiveDueDate,
      });

      return {
        paymentId: payment?.id ?? null,
        student: membership.student,
        billingMonth,
        dueDate: effectiveDueDate,
        amount,
        paidAmount,
        debtAmount: getDebtAmount(amount, paidAmount),
        status,
        paidAt: payment?.paidAt ?? null,
        notes: payment?.notes ?? null,
      };
    });

    const totalStudents = entries.length;
    const expectedAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const collectedAmount = entries.reduce((sum, entry) => sum + entry.paidAmount, 0);
    const debtAmount = entries.reduce((sum, entry) => sum + entry.debtAmount, 0);

    return jsonSuccess(
      {
        group: {
          id: group.id,
          name: group.name,
          subject: group.subject,
          monthlyFee: group.monthlyFee,
          isActive: group.isActive,
        },
        billingMonth,
        dueDate,
        totals: {
          totalStudents,
          expectedAmount,
          collectedAmount,
          debtAmount,
          paidStudents: entries.filter((entry) => entry.status === PaymentStatus.PAID).length,
          partialStudents: entries.filter((entry) => entry.status === PaymentStatus.PARTIAL).length,
          unpaidStudents: entries.filter((entry) => entry.status === PaymentStatus.UNPAID).length,
          overdueStudents: entries.filter((entry) => entry.status === PaymentStatus.OVERDUE).length,
        },
        paidStudents: entries.filter((entry) => entry.status === PaymentStatus.PAID),
        debtors: entries.filter(
          (entry) =>
            entry.status === PaymentStatus.UNPAID ||
            entry.status === PaymentStatus.OVERDUE ||
            entry.status === PaymentStatus.PARTIAL,
        ),
        entries,
      },
      "Payment summary fetched successfully",
    );
  } catch (error) {
    return handleApiError(error, "Payment summary API error");
  }
}
