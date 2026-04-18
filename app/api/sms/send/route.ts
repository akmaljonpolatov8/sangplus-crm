import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { sendSMS } from "@/lib/eskiz";
import { normalizeBillingMonth } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const sendSmsSchema = z.object({
  studentId: z.string().cuid(),
  parentPhone: z.string().trim().min(7).max(20),
  message: z.string().trim().min(5).max(1000),
  type: z.string().trim().max(100).default("PAYMENT_REMINDER"),
  month: z.string().trim().optional(),
  forceResend: z.boolean().default(false),
});

const smsHistoryQuerySchema = z.object({
  studentId: z.string().cuid(),
  limit: z.coerce.number().int().positive().max(100).default(30),
  month: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const url = new URL(request.url);
    const query = smsHistoryQuerySchema.parse({
      studentId: url.searchParams.get("studentId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
    });

    const month = normalizeBillingMonth(query.month ?? new Date());

    const smsLogDelegate = (
      db as unknown as {
        smsLog: {
          findMany: (args: unknown) => Promise<unknown>;
        };
      }
    ).smsLog;

    const history = await smsLogDelegate.findMany({
      where: {
        studentId: query.studentId,
        ...(query.month ? { month } : {}),
      },
      select: {
        id: true,
        studentId: true,
        parentPhone: true,
        message: true,
        type: true,
        month: true,
        provider: true,
        externalId: true,
        errorMessage: true,
        status: true,
        sentAt: true,
      },
      orderBy: { sentAt: "desc" },
      take: query.limit,
    });

    return jsonSuccess(history, "SMS tarixi olindi");
  } catch (error) {
    return handleApiError(error, "SMS history API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const body = await parseJson(request, sendSmsSchema);
    const month = normalizeBillingMonth(body.month ?? new Date());

    const student = await db.student.findUnique({
      where: { id: body.studentId },
      select: {
        id: true,
      },
    });

    if (!student) {
      return jsonError(404, "Student not found");
    }

    const smsLogDelegate = (
      db as unknown as {
        smsLog: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            sentAt: Date;
          } | null>;
          create: (args: unknown) => Promise<{
            id: string;
            sentAt: Date;
            type: string;
            status: string;
            month: Date;
            provider: string | null;
            externalId: string | null;
            errorMessage: string | null;
          }>;
        };
      }
    ).smsLog;

    const alreadySentThisMonth = await smsLogDelegate.findFirst({
      where: {
        studentId: body.studentId,
        month,
        status: "SENT",
      },
      select: {
        id: true,
        sentAt: true,
      },
      orderBy: {
        sentAt: "desc",
      },
    });

    if (alreadySentThisMonth && !body.forceResend) {
      return jsonError(409, "SMS already sent this month", {
        lastSentAt: alreadySentThisMonth.sentAt,
        requiresConfirm: true,
      });
    }

    const smsResult = await sendSMS(body.parentPhone, body.message);

    const log = await smsLogDelegate.create({
      data: {
        studentId: body.studentId,
        parentPhone: body.parentPhone,
        message: body.message,
        type: body.type,
        month,
        status: smsResult.success ? "SENT" : "FAILED",
        provider: "eskiz",
        externalId: smsResult.externalId ?? null,
        errorMessage: smsResult.error ?? null,
      },
      select: {
        id: true,
        type: true,
        sentAt: true,
        status: true,
        month: true,
        provider: true,
        externalId: true,
        errorMessage: true,
      },
    });

    if (!smsResult.success) {
      return jsonError(502, smsResult.error || "Eskiz SMS yuborilmadi", {
        sentAt: log.sentAt,
      });
    }

    return jsonSuccess(
      {
        id: log.id,
        type: log.type,
        status: log.status,
        sentAt: log.sentAt,
        month: log.month,
        provider: log.provider,
        externalId: log.externalId,
      },
      "SMS yuborildi",
    );
  } catch (error) {
    return handleApiError(error, "SMS send API error");
  }
}
