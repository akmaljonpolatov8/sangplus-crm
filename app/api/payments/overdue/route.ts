import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeBillingMonth, toNumberAmount } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const overdueQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const query = overdueQuerySchema.parse({
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
    });

    const now = new Date();
    const monthStart = normalizeBillingMonth(now);
    const month15 = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 15),
    );

    if (now <= month15) {
      return jsonSuccess([], "15-kungacha qarzdorlar yo'q");
    }

    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    );

    const memberships = await db.groupStudent.findMany({
      where: {
        ...(query.groupId ? { groupId: query.groupId } : {}),
        joinedAt: { lte: monthEnd },
        OR: [{ leftAt: null }, { leftAt: { gte: monthStart } }],
        student: {
          status: {
            not: "INACTIVE",
          },
        },
      },
      select: {
        studentId: true,
        groupId: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentPhone: true,
            parentName: true,
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
    });

    if (memberships.length === 0) {
      return jsonSuccess([], "Qarzdorlar topilmadi");
    }

    const paidPayments = await db.payment.findMany({
      where: {
        billingMonth: monthStart,
        status: "PAID",
        OR: memberships.map((item) => ({
          studentId: item.studentId,
          groupId: item.groupId,
        })),
      },
      select: {
        studentId: true,
        groupId: true,
      },
    });

    const paidSet = new Set(
      paidPayments.map((item) => `${item.studentId}:${item.groupId}`),
    );

    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - month15.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const overdueList = memberships
      .filter((item) => !paidSet.has(`${item.studentId}:${item.groupId}`))
      .map((item) => ({
        studentId: item.student.id,
        fullName: `${item.student.firstName} ${item.student.lastName}`.trim(),
        groupName: item.group.name,
        parentPhone: item.student.parentPhone,
        parentName: item.student.parentName,
        monthlyFee: toNumberAmount(item.group.monthlyFee),
        daysOverdue,
        billingMonth: monthStart,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return jsonSuccess(overdueList, "Qarzdorlar ro'yxati olindi");
  } catch (error) {
    return handleApiError(error, "Payments overdue API error");
  }
}
