import { Role, StudentStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  handleApiError,
  jsonError,
  jsonSuccess,
  parseJson,
  uniqueValues,
} from "@/lib/api";
import { db } from "@/lib/db";
import { optionalPhoneSchema, requiredPhoneSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: optionalPhoneSchema,
  parentPhone: requiredPhoneSchema,
  parentName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.nativeEnum(StudentStatus).default(StudentStatus.ACTIVE),
  groupIds: z.array(z.string().cuid()).default([]),
});

const studentQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  groupId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const query = studentQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
    });
    const { groupId, search, status } = query;

    const students = await db.student.findMany({
      where: {
        status,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { parentName: { contains: search, mode: "insensitive" } },
                { parentPhone: { contains: search } },
              ],
            }
          : {}),
        ...(groupId
          ? {
              groups: {
                some: {
                  groupId,
                  leftAt: null,
                },
              },
            }
          : {}),
        ...(actor.role === Role.TEACHER
          ? {
              groups: {
                some: {
                  leftAt: null,
                  group: {
                    teacherId: actor.id,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        parentPhone: true,
        parentName: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        groups: {
          where: {
            leftAt: null,
          },
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return jsonSuccess(students, "Students fetched successfully");
  } catch (error) {
    return handleApiError(error, "Students API error");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const { groupIds, ...studentData } = await parseJson(
      request,
      createStudentSchema,
    );
    let uniqueGroupIds = uniqueValues(groupIds);

    // For TEACHER: auto-link to their group, ensure no group specified or it's their own
    if (actor.role === Role.TEACHER) {
      const teacherGroups = await db.group.findMany({
        where: { teacherId: actor.id },
        select: { id: true },
      });

      const teacherGroupIds = teacherGroups.map((g) => g.id);

      // If teacher specified groups, validate they're all their own
      if (uniqueGroupIds.length > 0) {
        const allOwnGroups = uniqueGroupIds.every((gid) =>
          teacherGroupIds.includes(gid),
        );
        if (!allOwnGroups) {
          return jsonError(403, "You can only add students to your own groups");
        }
      } else {
        // If no groups specified, use error (teacher must specify a group)
        if (teacherGroupIds.length === 0) {
          return jsonError(400, "You have no groups to add students to");
        }
        // For teacher with single group, default to it; otherwise require selection
        if (teacherGroupIds.length === 1) {
          uniqueGroupIds = teacherGroupIds;
        } else {
          return jsonError(400, "Please select a group for the student");
        }
      }
    } else {
      // OWNER/MANAGER: validate all specified groups exist
      if (uniqueGroupIds.length > 0) {
        const groupsCount = await db.group.count({
          where: {
            id: {
              in: uniqueGroupIds,
            },
          },
        });

        if (groupsCount !== uniqueGroupIds.length) {
          return jsonError(400, "One or more groups do not exist");
        }
      }
    }

    const student = await db.$transaction(async (tx) => {
      const createdStudent = await tx.student.create({
        data: studentData,
      });

      if (uniqueGroupIds.length > 0) {
        await tx.groupStudent.createMany({
          data: uniqueGroupIds.map((groupId) => ({
            groupId,
            studentId: createdStudent.id,
          })),
        });
      }

      return tx.student.findUniqueOrThrow({
        where: { id: createdStudent.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          parentPhone: true,
          parentName: true,
          notes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          groups: {
            where: {
              leftAt: null,
            },
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

    return jsonSuccess(student, "Student created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Students API error");
  }
}
