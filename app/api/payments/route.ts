import { PaymentStatus, Prisma, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import {
  assertValidPaymentAmounts,
  calculatePaymentStatus,
  getPaymentDueDate,
  normalizeBillingMonth,
  serializeManagerPayment,
  serializeOwnerPayment,
  toNumberAmount,
} from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const paymentsQuerySchema = z.object({
  studentId: z.string().cuid().optional(),
  groupId: z.string().cuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
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
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      billingMonth:
        request.nextUrl.searchParams.get("billingMonth") ?? undefined,
      overdueOnly: request.nextUrl.searchParams.get("overdueOnly") ?? undefined,
    });

    const normalizedMonth = query.month
      ? normalizeBillingMonth(`${query.month}-01`)
      : query.billingMonth
        ? normalizeBillingMonth(query.billingMonth)
        : undefined;

    if (query.groupId && normalizedMonth && query.month) {
      const dueDate = getPaymentDueDate(normalizedMonth);
      const monthEnd = new Date(
        Date.UTC(
          normalizedMonth.getUTCFullYear(),
          normalizedMonth.getUTCMonth() + 1,
          0,
        ),
      );

      const memberships = await db.groupStudent.findMany({
        where: {
          groupId: query.groupId,
          joinedAt: { lte: monthEnd },
          OR: [{ leftAt: null }, { leftAt: { gte: normalizedMonth } }],
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
        orderBy: [
          { student: { lastName: "asc" } },
          { student: { firstName: "asc" } },
        ],
      });

      const existingPayments = await db.payment.findMany({
        where: {
          groupId: query.groupId,
          billingMonth: normalizedMonth,
          studentId: {
            in: memberships.map((membership) => membership.studentId),
          },
        },
        select: {
          id: true,
          studentId: true,
          amount: true,
          paidAmount: true,
          status: true,
          billingMonth: true,
          dueDate: true,
          notes: true,
          paidAt: true,
        },
      });

      const paymentByStudentId = new Map(
        existingPayments.map((payment) => [payment.studentId, payment]),
      );

      const rows = memberships
        .map((membership) => {
          const payment = paymentByStudentId.get(membership.studentId);
          const amount = payment
            ? toNumberAmount(
                payment.amount,
                Number(membership.group.monthlyFee),
              )
            : Number(membership.group.monthlyFee);
          const paidAmount = payment
            ? toNumberAmount(payment.paidAmount, 0)
            : 0;
          const resolvedDueDate = payment?.dueDate ?? dueDate;
          const status = calculatePaymentStatus({
            amount,
            paidAmount,
            dueDate: resolvedDueDate,
          });

          const payload = {
            id: payment?.id ?? `${membership.student.id}-${query.groupId}`,
            paymentId: payment?.id ?? null,
            billingMonth: normalizedMonth,
            dueDate: resolvedDueDate,
            status,
            amount,
            paidAmount,
            notes: payment?.notes ?? null,
            paidAt: payment?.paidAt ?? null,
            student: membership.student,
            group: {
              id: membership.group.id,
              name: membership.group.name,
            },
          };

          if (actor.role === Role.OWNER) {
            return payload;
          }

          return {
            id: payload.id,
            paymentId: payload.paymentId,
            billingMonth: payload.billingMonth,
            dueDate: payload.dueDate,
            status: payload.status,
            student: payload.student,
            group: payload.group,
          };
        })
        .filter((payment) =>
          query.overdueOnly
            ? payment.status === PaymentStatus.OVERDUE
            : query.status
              ? payment.status === query.status
              : true,
        );

      return jsonSuccess(rows, "Group payments fetched successfully");
    }

    const paymentWhere = {
      studentId: query.studentId,
      groupId: query.groupId,
      ...(normalizedMonth ? { billingMonth: normalizedMonth } : {}),
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

      const serializedPayments = payments
        .map(serializeOwnerPayment)
        .filter((payment) =>
          query.overdueOnly
            ? payment.status === PaymentStatus.OVERDUE
            : query.status
              ? payment.status === query.status
              : true,
        );

      return jsonSuccess(serializedPayments, "Payments fetched successfully");
    }

    const payments = await db.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        billingMonth: true,
        dueDate: true,
        status: true,
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

    const serializedPayments = payments
      .map(serializeManagerPayment)
      .filter((payment) =>
        query.overdueOnly
          ? payment.status === PaymentStatus.OVERDUE
          : query.status
            ? payment.status === query.status
            : true,
      );

    return jsonSuccess(serializedPayments, "Payments fetched successfully");
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

    if (paidAmount > amount) {
      return jsonError(
        400,
        "Paid amount cannot be greater than the total amount",
      );
    }

    assertValidPaymentAmounts(amount, paidAmount);
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
      serializeOwnerPayment({
        ...payment,
        amount: toNumberAmount(payment.amount),
        paidAmount: toNumberAmount(payment.paidAmount),
      }),
      "Payment created successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error, "Payments API error");
  }
}
