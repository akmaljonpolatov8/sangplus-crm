import { PaymentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

function toDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isCronRequest(request: Request) {
  return request.headers.has("x-vercel-cron");
}

export async function POST(request: Request) {
  try {
    if (!isCronRequest(request)) {
      await requireUser(request, [Role.OWNER, Role.MANAGER]);
    }

    const today = toDateOnly(new Date());
    const threshold = new Date(today.getTime() - FIFTEEN_DAYS_MS);

    const memberships = await db.groupStudent.findMany({
      where: {
        leftAt: null,
        student: {
          status: "ACTIVE",
        },
        group: {
          isActive: true,
        },
      },
      select: {
        groupId: true,
        studentId: true,
        joinedAt: true,
        group: {
          select: {
            monthlyFee: true,
          },
        },
      },
    });

    let createdCount = 0;

    for (const membership of memberships) {
      const lastPayment = await db.payment.findFirst({
        where: {
          studentId: membership.studentId,
          groupId: membership.groupId,
        },
        orderBy: {
          dueDate: "desc",
        },
        select: {
          dueDate: true,
        },
      });

      const baselineDate = lastPayment?.dueDate ?? membership.joinedAt;

      if (baselineDate > threshold) {
        continue;
      }

      const dueDate = toDateOnly(addDays(today, 15));

      await db.payment.upsert({
        where: {
          studentId_groupId_billingMonth: {
            studentId: membership.studentId,
            groupId: membership.groupId,
            billingMonth: today,
          },
        },
        update: {},
        create: {
          studentId: membership.studentId,
          groupId: membership.groupId,
          billingMonth: today,
          dueDate,
          amount: membership.group.monthlyFee,
          status: PaymentStatus.UNPAID,
          paidAmount: 0,
        },
      });

      createdCount += 1;
    }

    return jsonSuccess(
      {
        runDate: today,
        createdCount,
        scannedMemberships: memberships.length,
      },
      "15 kunlik to'lovlar generatsiyasi tugadi",
    );
  } catch (error) {
    return handleApiError(error, "Generate monthly payments API error");
  }
}
