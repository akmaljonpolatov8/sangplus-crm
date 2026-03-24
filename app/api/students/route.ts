import { Role, StudentStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson, uniqueValues } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30).optional(),
  parentPhone: z.string().trim().min(5).max(30),
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
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER, Role.TEACHER]);
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
                { phone: { contains: search, mode: "insensitive" } },
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
    await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const { groupIds, ...studentData } = await parseJson(request, createStudentSchema);
    const uniqueGroupIds = uniqueValues(groupIds);

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
