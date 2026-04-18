import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import {
  getPaymentDueDate,
  normalizeBillingMonth,
  toNumberAmount,
} from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const debtorsQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const query = debtorsQuerySchema.parse({
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const currentMonth = normalizeBillingMonth(new Date());
    const monthDueDate = getPaymentDueDate(currentMonth);

    const memberships = await db.groupStudent.findMany({
      where: {
        leftAt: null,
        ...(query.groupId ? { groupId: query.groupId } : {}),
        group: {
          isActive: true,
        },
        student: {
          status: {
            not: "INACTIVE",
          },
        },
      },
      select: {
        groupId: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentName: true,
            phone: true,
            parentPhone: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            monthlyFee: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
      take: query.limit,
    });

    const payments = await db.payment.findMany({
      where: {
        billingMonth: currentMonth,
        studentId: {
          in: memberships.map((membership) => membership.student.id),
        },
        groupId: {
          in: memberships.map((membership) => membership.group.id),
        },
      },
      select: {
        id: true,
        groupId: true,
        studentId: true,
        billingMonth: true,
        dueDate: true,
        amount: true,
        paidAmount: true,
        status: true,
      },
    });

    const paymentByMembership = new Map(
      payments.map((payment) => [
        `${payment.studentId}:${payment.groupId}`,
        payment,
      ]),
    );

    const smsLogDelegate = (
      db as unknown as {
        smsLog: {
          findMany: (args: unknown) => Promise<
            Array<{
              studentId: string;
              sentAt: Date;
              status: string;
            }>
          >;
        };
      }
    ).smsLog;

    const smsMonthLogs = await smsLogDelegate.findMany({
      where: {
        month: currentMonth,
        status: "SENT",
        studentId: {
          in: memberships.map((membership) => membership.student.id),
        },
      },
      select: {
        studentId: true,
        sentAt: true,
        status: true,
      },
      orderBy: {
        sentAt: "desc",
      },
    });

    const latestSentByStudent = new Map<string, Date>();
    for (const entry of smsMonthLogs) {
      if (!latestSentByStudent.has(entry.studentId)) {
        latestSentByStudent.set(entry.studentId, entry.sentAt);
      }
    }

    const now = Date.now();

    const debtors = memberships
      .map((membership) => {
        const payment = paymentByMembership.get(
          `${membership.student.id}:${membership.group.id}`,
        );
        const amount = payment
          ? toNumberAmount(payment.amount, Number(membership.group.monthlyFee))
          : Number(membership.group.monthlyFee);
        const paidAmount = payment ? toNumberAmount(payment.paidAmount, 0) : 0;
        const isPaid =
          payment?.status === "PAID" || (amount > 0 && paidAmount >= amount);

        if (isPaid) {
          return null;
        }

        const dueDate = payment?.dueDate ?? monthDueDate;
        const daysOverdue = Math.max(
          0,
          Math.floor((now - dueDate.getTime()) / (24 * 60 * 60 * 1000)),
        );
        const lastSentAt =
          latestSentByStudent.get(membership.student.id) ?? null;

        return {
          paymentId:
            payment?.id ?? `${membership.student.id}:${membership.group.id}`,
          studentId: membership.student.id,
          studentName: `${membership.student.firstName} ${membership.student.lastName}`,
          parentName: membership.student.parentName,
          phone: membership.student.phone,
          parentPhone: membership.student.parentPhone,
          groupId: membership.group.id,
          groupName: membership.group.name,
          billingMonth: currentMonth,
          dueDate,
          daysOverdue,
          smsSentThisMonth: Boolean(lastSentAt),
          smsLastSentAt: lastSentAt,
          ...(actor.role === Role.OWNER ? { amount } : {}),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return jsonSuccess(debtors, "Qarzdorlar ro'yxati muvaffaqiyatli olindi");
  } catch (error) {
    return handleApiError(error, "Debtors API error");
  }
}
