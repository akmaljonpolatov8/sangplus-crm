import { Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const { id } = paramsSchema.parse(await params);

    const group = await db.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subject: true,
        scheduleDays: true,
        startTime: true,
        endTime: true,
        monthlyFee: true,
        isActive: true,
        teacherId: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    if (actor.role === Role.TEACHER && group.teacherId !== actor.id) {
      return jsonError(403, "You are not allowed to access this group");
    }

    return jsonSuccess(group, "Group fetched successfully");
  } catch (error) {
    return handleApiError(error, "Group detail API error");
  }
}

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().max(100).nullable().optional(),
  scheduleDays: z
    .array(z.string().trim().min(2).max(20))
    .min(1)
    .max(7)
    .optional(),
  startTime: z.string().trim().max(10).nullable().optional(),
  endTime: z.string().trim().max(10).nullable().optional(),
  monthlyFee: z.coerce.number().positive().optional(),
  teacherId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const { id } = paramsSchema.parse(await params);
    const body = await parseJson(request, updateGroupSchema);

    const group = await db.group.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    if (body.teacherId) {
      const teacher = await db.user.findFirst({
        where: {
          id: body.teacherId,
          role: Role.TEACHER,
          isActive: true,
        },
        select: { id: true },
      });

      if (!teacher) {
        return jsonError(400, "Teacher not found");
      }
    }

    const updatedGroup = await db.group.update({
      where: { id },
      data: {
        name: body.name,
        subject: body.subject === null ? null : body.subject,
        scheduleDays: body.scheduleDays,
        startTime: body.startTime === null ? null : body.startTime,
        endTime: body.endTime === null ? null : body.endTime,
        monthlyFee:
          body.monthlyFee === undefined
            ? undefined
            : new Prisma.Decimal(body.monthlyFee),
        teacherId: body.teacherId === null ? null : body.teacherId,
        isActive: body.isActive,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        scheduleDays: true,
        startTime: true,
        endTime: true,
        monthlyFee: true,
        isActive: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return jsonSuccess(updatedGroup, "Group updated successfully");
  } catch (error) {
    return handleApiError(error, "Group detail API error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const { id } = paramsSchema.parse(await params);

    const group = await db.group.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    await db.group.update({
      where: { id },
      data: { isActive: false },
    });

    return jsonSuccess(
      {
        id,
        deleted: true,
      },
      "Group deleted successfully",
    );
  } catch (error) {
    return handleApiError(error, "Group detail API error");
  }
}
