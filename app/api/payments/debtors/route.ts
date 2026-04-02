import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import { toNumberAmount } from "@/lib/payments";
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

    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    const payments = await db.payment.findMany({
      where: {
        status: "UNPAID",
        dueDate: {
          lt: cutoff,
        },
        ...(query.groupId ? { groupId: query.groupId } : {}),
      },
      select: {
        id: true,
        billingMonth: true,
        dueDate: true,
        amount: true,
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
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: query.limit,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const smsLogDelegate = (
      db as unknown as {
        smsLog: {
          findMany: (args: unknown) => Promise<Array<{ studentId: string }>>;
        };
      }
    ).smsLog;

    const smsTodayLogs = await smsLogDelegate.findMany({
      where: {
        sentAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
        studentId: {
          in: payments.map((payment) => payment.student.id),
        },
      },
      select: {
        studentId: true,
      },
    });

    const sentTodayStudentIds = new Set(
      smsTodayLogs.map((entry) => entry.studentId),
    );

    const now = Date.now();

    const debtors = payments
      .map((payment) => {
        const daysOverdue = Math.max(
          0,
          Math.floor((now - payment.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
        );

        return {
          paymentId: payment.id,
          studentId: payment.student.id,
          studentName: `${payment.student.firstName} ${payment.student.lastName}`,
          parentName: payment.student.parentName,
          phone: payment.student.phone,
          parentPhone: payment.student.parentPhone,
          groupId: payment.group.id,
          groupName: payment.group.name,
          billingMonth: payment.billingMonth,
          dueDate: payment.dueDate,
          daysOverdue,
          smsSentToday: sentTodayStudentIds.has(payment.student.id),
          ...(actor.role === Role.OWNER
            ? { amount: toNumberAmount(payment.amount) }
            : {}),
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return jsonSuccess(debtors, "Qarzdorlar ro'yxati muvaffaqiyatli olindi");
  } catch (error) {
    return handleApiError(error, "Debtors API error");
  }
}
