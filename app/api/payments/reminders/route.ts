import { PaymentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import {
  buildReminderText,
  calculatePaymentStatus,
  getBillingMonthEnd,
  getPaymentDueDate,
  normalizeBillingMonth,
  toNumberAmount,
} from "@/lib/payments";
import { sendSmsMessage } from "@/lib/sms";
import { z } from "zod";

export const runtime = "nodejs";

const sendRemindersSchema = z.object({
  groupId: z.string().cuid(),
  billingMonth: z.string().date(),
  dryRun: z.boolean().default(false),
});

const reminderHistoryQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
  billingMonth: z.string().date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

function getSmsReminderLogDelegate() {
  return (
    db as unknown as {
      smsReminderLog: {
        findMany: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<unknown>;
      };
    }
  ).smsReminderLog;
}

export async function GET(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const url = new URL(request.url);
    const query = reminderHistoryQuerySchema.parse({
      groupId: url.searchParams.get("groupId") ?? undefined,
      billingMonth: url.searchParams.get("billingMonth") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const smsReminderLog = getSmsReminderLogDelegate();
    const history = await smsReminderLog.findMany({
      where: {
        groupId: query.groupId,
        ...(query.billingMonth
          ? { billingMonth: normalizeBillingMonth(query.billingMonth) }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        groupId: true,
        billingMonth: true,
        studentId: true,
        studentName: true,
        parentPhone: true,
        provider: true,
        status: true,
        externalId: true,
        errorMessage: true,
        createdAt: true,
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        sentBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    return jsonSuccess(history, "Reminder history fetched successfully");
  } catch (error) {
    return handleApiError(error, "Payment reminders API error");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const body = await parseJson(request, sendRemindersSchema);
    const billingMonth = normalizeBillingMonth(body.billingMonth);
    const billingMonthEnd = getBillingMonthEnd(billingMonth);
    const fallbackDueDate = getPaymentDueDate(billingMonth);

    const group = await db.group.findUnique({
      where: { id: body.groupId },
      select: {
        id: true,
        name: true,
        monthlyFee: true,
      },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    const memberships = await db.groupStudent.findMany({
      where: {
        groupId: body.groupId,
        joinedAt: { lte: billingMonthEnd },
        OR: [{ leftAt: null }, { leftAt: { gte: billingMonth } }],
        student: {
          status: {
            not: "INACTIVE",
          },
        },
      },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentPhone: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      return jsonSuccess(
        {
          totalStudents: 0,
          overdueStudents: 0,
          sent: 0,
          failed: 0,
          dryRun: body.dryRun,
          recipients: [],
        },
        "No active students found for this group and month",
      );
    }

    const payments = await db.payment.findMany({
      where: {
        groupId: body.groupId,
        billingMonth,
        studentId: {
          in: memberships.map((item) => item.studentId),
        },
      },
      select: {
        studentId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    const paymentMap = new Map(payments.map((item) => [item.studentId, item]));
    const groupDefaultAmount = toNumberAmount(group.monthlyFee, 0);

    const overdueEntries = memberships
      .map((membership) => {
        const payment = paymentMap.get(membership.studentId);
        const amount = payment
          ? toNumberAmount(payment.amount, groupDefaultAmount)
          : groupDefaultAmount;
        const paidAmount = payment ? toNumberAmount(payment.paidAmount, 0) : 0;
        const dueDate = payment?.dueDate ?? fallbackDueDate;

        const status = calculatePaymentStatus({
          amount,
          paidAmount,
          dueDate,
        });

        return {
          studentId: membership.student.id,
          studentName:
            `${membership.student.firstName} ${membership.student.lastName}`.trim(),
          parentPhone: membership.student.parentPhone,
          status,
        };
      })
      .filter((entry) => entry.status === PaymentStatus.OVERDUE);

    let sent = 0;
    let failed = 0;

    const recipients: Array<{
      studentId: string;
      studentName: string;
      parentPhone: string;
      status: "sent" | "failed" | "skipped";
      reason?: string;
    }> = [];

    for (const entry of overdueEntries) {
      if (!entry.parentPhone) {
        failed += 1;
        recipients.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          parentPhone: "",
          status: "failed",
          reason: "Parent phone is missing",
        });
        continue;
      }

      if (body.dryRun) {
        recipients.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          parentPhone: entry.parentPhone,
          status: "skipped",
          reason: "dryRun=true",
        });
        continue;
      }

      const message = buildReminderText(entry.studentName, group.name);
      const smsResult = await sendSmsMessage(entry.parentPhone, message);

      const smsReminderLog = getSmsReminderLogDelegate();
      await smsReminderLog.create({
        data: {
          groupId: group.id,
          billingMonth,
          studentId: entry.studentId,
          studentName: entry.studentName,
          parentPhone: entry.parentPhone,
          message,
          provider: smsResult.provider,
          status: smsResult.ok ? "sent" : "failed",
          externalId: smsResult.externalId,
          errorMessage: smsResult.ok ? null : smsResult.error,
          sentById: actor.id,
        },
      });

      if (smsResult.ok) {
        sent += 1;
        recipients.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          parentPhone: entry.parentPhone,
          status: "sent",
        });
      } else {
        failed += 1;
        recipients.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          parentPhone: entry.parentPhone,
          status: "failed",
          reason: smsResult.error || "SMS send failed",
        });
      }
    }

    return jsonSuccess(
      {
        totalStudents: memberships.length,
        overdueStudents: overdueEntries.length,
        sent,
        failed,
        dryRun: body.dryRun,
        recipients,
      },
      body.dryRun
        ? "Dry-run completed for payment reminders"
        : "Payment reminders processed",
    );
  } catch (error) {
    return handleApiError(error, "Payment reminders API error");
  }
}
