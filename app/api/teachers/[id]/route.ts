import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  handleApiError,
  jsonError,
  jsonSuccess,
  parseJson,
  uniqueValues,
} from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { strongPasswordSchema, usernameSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const updateTeacherSchema = z.object({
  username: usernameSchema.optional(),
  password: strongPasswordSchema.optional(),
  fullName: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  groupIds: z.array(z.string().cuid()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const { id } = paramsSchema.parse(await params);
    const { groupIds, password, ...body } = await parseJson(
      request,
      updateTeacherSchema,
    );
    const uniqueGroupIds = groupIds ? uniqueValues(groupIds) : undefined;

    if (
      actor.role === Role.MANAGER &&
      (password !== undefined || body.isActive !== undefined)
    ) {
      return jsonError(
        403,
        "Manager cannot change teacher password or active status",
      );
    }

    const teacher = await db.user.findFirst({
      where: {
        id,
        role: Role.TEACHER,
      },
      select: { id: true },
    });

    if (!teacher) {
      return jsonError(404, "Teacher not found");
    }

    if (uniqueGroupIds && uniqueGroupIds.length > 0) {
      const groupsCount = await db.group.count({
        where: {
          id: { in: uniqueGroupIds },
        },
      });

      if (groupsCount !== uniqueGroupIds.length) {
        return jsonError(400, "One or more groups do not exist");
      }
    }

    const updatedTeacher = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          username: body.username,
          fullName: body.fullName,
          ...(actor.role === Role.OWNER ? { isActive: body.isActive } : {}),
          ...(actor.role === Role.OWNER && password
            ? { passwordHash: hashPassword(password) }
            : {}),
        },
      });

      if (uniqueGroupIds) {
        await tx.group.updateMany({
          where: { teacherId: id },
          data: { teacherId: null },
        });

        if (uniqueGroupIds.length > 0) {
          await tx.group.updateMany({
            where: { id: { in: uniqueGroupIds } },
            data: { teacherId: id },
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
          updatedAt: true,
          groups: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });
    });

    return jsonSuccess(updatedTeacher, "Teacher updated successfully");
  } catch (error) {
    return handleApiError(error, "Teacher detail API error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { id } = paramsSchema.parse(await params);

    const teacher = await db.user.findFirst({
      where: {
        id,
        role: Role.TEACHER,
      },
      select: { id: true },
    });

    if (!teacher) {
      return jsonError(404, "Teacher not found");
    }

    await db.$transaction([
      db.group.updateMany({
        where: { teacherId: id },
        data: { teacherId: null },
      }),
      db.attendance.deleteMany({
        where: { markedById: id },
      }),
      db.lessonSession.deleteMany({
        where: { startedById: id },
      }),
      db.smsReminderLog.deleteMany({
        where: { sentById: id },
      }),
      db.user.delete({
        where: { id },
      }),
    ]);

    return jsonSuccess(
      {
        id,
        deleted: true,
      },
      "Teacher deleted successfully",
    );
  } catch (error) {
    return handleApiError(error, "Teacher detail API error");
  }
}
