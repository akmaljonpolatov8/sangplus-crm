import { Role, StudentStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  handleApiError,
  jsonError,
  jsonSuccess,
  parseJson,
  uniqueValues,
} from "@/lib/api";
import { db } from "@/lib/db";
import { nullablePhoneSchema, requiredPhoneSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: nullablePhoneSchema,
  parentPhone: requiredPhoneSchema.optional(),
  parentName: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  groupIds: z.array(z.string().cuid()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const { id } = paramsSchema.parse(await params);
    const body = await parseJson(request, updateStudentSchema);
    const groupIds = body.groupIds ? uniqueValues(body.groupIds) : undefined;

    const existingStudent = await db.student.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingStudent) {
      return jsonError(404, "Student not found");
    }

    if (groupIds && groupIds.length > 0) {
      const groupsCount = await db.group.count({
        where: {
          id: { in: groupIds },
        },
      });

      if (groupsCount !== groupIds.length) {
        return jsonError(400, "One or more groups do not exist");
      }
    }

    const student = await db.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone === null ? null : body.phone,
          parentPhone: body.parentPhone,
          parentName: body.parentName === null ? null : body.parentName,
          notes: body.notes === null ? null : body.notes,
          status: body.status,
        },
      });

      if (groupIds) {
        const memberships = await tx.groupStudent.findMany({
          where: { studentId: id },
          select: {
            id: true,
            groupId: true,
            leftAt: true,
          },
        });

        const membershipByGroupId = new Map(
          memberships.map((membership) => [membership.groupId, membership]),
        );
        const now = new Date();

        for (const membership of memberships) {
          if (
            membership.leftAt === null &&
            !groupIds.includes(membership.groupId)
          ) {
            await tx.groupStudent.update({
              where: { id: membership.id },
              data: { leftAt: now },
            });
          }
        }

        for (const groupId of groupIds) {
          const membership = membershipByGroupId.get(groupId);

          if (!membership) {
            await tx.groupStudent.create({
              data: {
                groupId,
                studentId: id,
              },
            });
            continue;
          }

          if (membership.leftAt !== null) {
            await tx.groupStudent.update({
              where: { id: membership.id },
              data: { leftAt: null },
            });
          }
        }
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          parentPhone: true,
          parentName: true,
          notes: true,
          status: true,
          updatedAt: true,
          groups: {
            where: { leftAt: null },
            select: {
              groupId: true,
              group: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    return jsonSuccess(student, "Student updated successfully");
  } catch (error) {
    return handleApiError(error, "Student detail API error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const { id } = paramsSchema.parse(await params);
    const student = await db.student.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!student) {
      return jsonError(404, "Student not found");
    }

    await db.$transaction(async (tx) => {
      await tx.groupStudent.deleteMany({
        where: {
          studentId: id,
        },
      });

      await tx.attendance.deleteMany({
        where: {
          studentId: id,
        },
      });

      await tx.payment.deleteMany({
        where: {
          studentId: id,
        },
      });

      await tx.student.delete({
        where: {
          id,
        },
      });
    });

    return jsonSuccess(
      {
        id: student.id,
        deleted: true,
      },
      "Student deleted successfully",
    );
  } catch (error) {
    return handleApiError(error, "Student detail API error");
  }
}
