import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/rbac";
import { maskPayment } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a date to the 1st of its month at midnight UTC. */
function normaliseToMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createPaymentSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  groupId: z.string().min(1, "groupId is required"),
  amountCents: z.number().int().positive("amountCents must be positive"),
  // forMonth can be any date in the target month; it will be normalised
  forMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, "forMonth must be YYYY-MM or YYYY-MM-DD")
    .transform((v) => normaliseToMonthStart(new Date(v))),
  paidAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/payments
// Query params: studentId, groupId, from (YYYY-MM-DD), to (YYYY-MM-DD)
// Only OWNER sees amountCents; MANAGER/TEACHER get it stripped.
// TEACHER: no access to payments.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  // TEACHER has no access to payment list
  if (auth.user.role === "TEACHER") {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("studentId") ?? undefined;
  const groupId = searchParams.get("groupId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const payments = await prisma.payment.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(groupId ? { groupId } : {}),
      ...(from || to
        ? {
            forMonth: {
              ...(from ? { gte: normaliseToMonthStart(new Date(from)) } : {}),
              ...(to ? { lte: normaliseToMonthStart(new Date(to)) } : {}),
            },
          }
        : {}),
    },
    include: {
      student: { select: { id: true, fullName: true } },
      group: { select: { id: true, name: true } },
      createdBy: { select: { id: true, username: true } },
    },
    orderBy: { paidAt: "desc" },
  });

  // Mask amountCents for non-OWNER roles
  const data = payments.map((p) => maskPayment(p, auth.user.role));

  return Response.json({ data });
}

// ---------------------------------------------------------------------------
// POST /api/payments  (OWNER and MANAGER only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  if (auth.user.role === "TEACHER") {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const { studentId, groupId, amountCents, forMonth, paidAt, note } =
    parsed.data;

  // Verify the student is enrolled in the group
  const membership = await prisma.groupStudent.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
  });
  if (!membership) {
    return Response.json(
      {
        error: {
          message: "Student is not enrolled in this group",
          code: "NOT_ENROLLED",
        },
      },
      { status: 422 }
    );
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        studentId,
        groupId,
        amountCents,
        forMonth,
        paidAt: paidAt ? new Date(paidAt) : undefined,
        createdByUserId: auth.user.sub,
        note,
      },
      include: {
        student: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return Response.json({ data: payment }, { status: 201 });
  } catch (err: unknown) {
    // Unique constraint violation – already paid for this month
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return Response.json(
        {
          error: {
            message: "Payment for this student/group/month already exists",
            code: "DUPLICATE_PAYMENT",
          },
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
