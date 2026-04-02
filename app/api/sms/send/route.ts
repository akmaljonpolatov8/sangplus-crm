import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const sendSmsSchema = z.object({
  studentId: z.string().cuid(),
  parentPhone: z.string().trim().min(7).max(20),
  message: z.string().trim().min(5).max(1000),
  type: z.string().trim().max(100).default("PAYMENT_REMINDER"),
});

const smsHistoryQuerySchema = z.object({
  studentId: z.string().cuid(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export async function GET(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const url = new URL(request.url);
    const query = smsHistoryQuerySchema.parse({
      studentId: url.searchParams.get("studentId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

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
      },
      select: {
        id: true,
        studentId: true,
        parentPhone: true,
        message: true,
        type: true,
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

    console.log("[SMS:MANUAL_SEND]", {
      studentId: body.studentId,
      parentPhone: body.parentPhone,
      message: body.message,
    });

    const smsLogDelegate = (
      db as unknown as {
        smsLog: {
          create: (args: unknown) => Promise<{
            id: string;
            sentAt: Date;
            type: string;
            status: string;
          }>;
        };
      }
    ).smsLog;

    const log = await smsLogDelegate.create({
      data: {
        studentId: body.studentId,
        parentPhone: body.parentPhone,
        message: body.message,
        type: body.type,
        status: "PENDING",
      },
      select: {
        id: true,
        type: true,
        sentAt: true,
        status: true,
      },
    });

    return jsonSuccess(
      {
        id: log.id,
        type: log.type,
        status: log.status,
        sentAt: log.sentAt,
      },
      "SMS yuborildi",
    );
  } catch (error) {
    return handleApiError(error, "SMS send API error");
  }
}
