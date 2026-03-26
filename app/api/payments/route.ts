import { PaymentStatus, Prisma, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import {
  calculatePaymentStatus,
  getPaymentDueDate,
  normalizeBillingMonth,
  serializeManagerPayment,
  serializeOwnerPayment,
} from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const paymentsQuerySchema = z.object({
  studentId: z.string().cuid().optional(),
  groupId: z.string().cuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  billingMonth: z.string().date().optional(),
  overdueOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const createPaymentSchema = z.object({
  studentId: z.string().cuid(),
  groupId: z.string().cuid(),
  billingMonth: z.string().date(),
  amount: z.coerce.number().positive().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const query = paymentsQuerySchema.parse({
      studentId: request.nextUrl.searchParams.get("studentId") ?? undefined,
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      billingMonth:
        request.nextUrl.searchParams.get("billingMonth") ?? undefined,
      overdueOnly: request.nextUrl.searchParams.get("overdueOnly") ?? undefined,
    });

    const paymentWhere = {
      studentId: query.studentId,
      groupId: query.groupId,
      status: query.overdueOnly ? PaymentStatus.OVERDUE : query.status,
      ...(query.billingMonth
        ? { billingMonth: normalizeBillingMonth(query.billingMonth) }
        : {}),
    };

    if (actor.role === Role.OWNER) {
      const payments = await db.payment.findMany({
        where: paymentWhere,
        select: {
          id: true,
          billingMonth: true,
          dueDate: true,
          status: true,
          paidAt: true,
          notes: true,
          amount: true,
          paidAmount: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      });

      return jsonSuccess(
        payments.map(serializeOwnerPayment),
        "Payments fetched successfully",
      );
    }

    const payments = await db.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        billingMonth: true,
        dueDate: true,
        status: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    });

    return jsonSuccess(
      payments.map(serializeManagerPayment),
      "Payments fetched successfully",
    );
  } catch (error) {
    return handleApiError(error, "Payments API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER]);
    const body = await parseJson(request, createPaymentSchema);

    const groupStudent = await db.groupStudent.findFirst({
      where: {
        groupId: body.groupId,
        studentId: body.studentId,
        leftAt: null,
      },
      select: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        group: {
          select: {
            name: true,
            monthlyFee: true,
          },
        },
      },
    });

    if (!groupStudent) {
      return jsonError(400, "Student does not belong to the selected group");
    }

    const billingMonth = normalizeBillingMonth(body.billingMonth);
    const dueDate = getPaymentDueDate(billingMonth);
    const amount = body.amount ?? Number(groupStudent.group.monthlyFee);
    const paidAmount = body.paidAmount ?? 0;
    const status = calculatePaymentStatus({
      amount,
      paidAmount,
      dueDate,
    });

    const payment = await db.payment.upsert({
      where: {
        studentId_groupId_billingMonth: {
          studentId: body.studentId,
          groupId: body.groupId,
          billingMonth,
        },
      },
      update: {
        amount: new Prisma.Decimal(amount),
        paidAmount: new Prisma.Decimal(paidAmount),
        paidAt: body.paidAt
          ? new Date(body.paidAt)
          : paidAmount > 0
            ? new Date()
            : null,
        dueDate,
        notes: body.notes,
        status,
      },
      create: {
        studentId: body.studentId,
        groupId: body.groupId,
        billingMonth,
        dueDate,
        amount: new Prisma.Decimal(amount),
        paidAmount: new Prisma.Decimal(paidAmount),
        paidAt: body.paidAt
          ? new Date(body.paidAt)
          : paidAmount > 0
            ? new Date()
            : null,
        notes: body.notes,
        status,
      },
      select: {
        id: true,
        billingMonth: true,
        dueDate: true,
        amount: true,
        paidAmount: true,
        status: true,
        paidAt: true,
        notes: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
    });

    return jsonSuccess(
      serializeOwnerPayment(payment),
      "Payment created successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error, "Payments API error");
  }
}
