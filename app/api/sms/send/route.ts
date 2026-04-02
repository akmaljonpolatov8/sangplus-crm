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
});

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
          create: (args: unknown) => Promise<{ id: string; sentAt: Date }>;
        };
      }
    ).smsLog;

    const log = await smsLogDelegate.create({
      data: {
        studentId: body.studentId,
        parentPhone: body.parentPhone,
        message: body.message,
        status: "SENT",
      },
      select: {
        id: true,
        sentAt: true,
      },
    });

    return jsonSuccess(
      {
        id: log.id,
        status: "SENT",
        sentAt: log.sentAt,
      },
      "SMS yuborildi",
    );
  } catch (error) {
    return handleApiError(error, "SMS send API error");
  }
}
