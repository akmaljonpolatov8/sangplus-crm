import { Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { calculatePaymentStatus, serializeOwnerPayment } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { id } = paramsSchema.parse(await params);
    const body = await parseJson(request, updatePaymentSchema);

    const payment = await db.payment.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        group: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!payment) {
      return jsonError(404, "Payment not found");
    }

    const amount = body.amount ?? Number(payment.amount);
    const paidAmount = body.paidAmount ?? Number(payment.paidAmount ?? 0);
    const status = calculatePaymentStatus({
      amount,
      paidAmount,
      dueDate: payment.dueDate,
    });

    const updatedPayment = await db.payment.update({
      where: { id },
      data: {
        amount: body.amount === undefined ? undefined : new Prisma.Decimal(amount),
        paidAmount:
          body.paidAmount === undefined ? undefined : new Prisma.Decimal(paidAmount),
        paidAt:
          body.paidAt === undefined
            ? undefined
            : body.paidAt === null
              ? null
              : new Date(body.paidAt),
        notes: body.notes === undefined ? undefined : body.notes === null ? null : body.notes,
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
      serializeOwnerPayment(updatedPayment),
      "Payment updated successfully",
    );
  } catch (error) {
    return handleApiError(error, "Payment detail API error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { id } = paramsSchema.parse(await params);

    const payment = await db.payment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!payment) {
      return jsonError(404, "Payment not found");
    }

    await db.payment.delete({
      where: { id },
    });

    return jsonSuccess(
      {
        id,
        deleted: true,
      },
      "Payment deleted successfully",
    );
  } catch (error) {
    return handleApiError(error, "Payment detail API error");
  }
}
