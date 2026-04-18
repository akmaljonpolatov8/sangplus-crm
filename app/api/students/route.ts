import { Role, StudentStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  ApiError,
  handleApiError,
  jsonError,
  jsonSuccess,
  uniqueValues,
} from "@/lib/api";
import { db } from "@/lib/db";
import { addEskizContact } from "@/lib/eskiz";
import { optionalPhoneSchema, requiredPhoneSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: requiredPhoneSchema,
  parentPhone: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  }, optionalPhoneSchema),
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, "So'rov ma'lumotlari noto'g'ri formatda");
    }

    const parsedBody = createStudentSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const firstIssue = parsedBody.error.issues[0];
      const field = firstIssue?.path?.[0];
      if (field === "firstName") {
        return jsonError(400, "Ismi maydonini to'ldiring");
      }
      if (field === "lastName") {
        return jsonError(400, "Familiyasi maydonini to'ldiring");
      }
      if (field === "phone") {
        return jsonError(
          400,
          "Telefon raqam majburiy va to'g'ri formatda bo'lishi kerak",
        );
      }
      return jsonError(400, "Ma'lumotlar noto'g'ri kiritilgan");
    }

    const { groupIds, ...studentData } = parsedBody.data;
    let uniqueGroupIds = uniqueValues(groupIds);

    const existingPhone = await db.student.findFirst({
      where: {
        phone: studentData.phone,
      },
      select: {
        id: true,
      },
    });

    if (existingPhone) {
      return jsonError(400, "Bu telefon raqam allaqachon mavjud");
    }

    const normalizedStudentData = {
      ...studentData,
      parentPhone: studentData.parentPhone || studentData.phone,
      parentName: studentData.parentName || null,
      notes: studentData.notes || null,
    };

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
          return jsonError(
            403,
            "Faqat o'zingizga biriktirilgan guruhlarga qo'sha olasiz",
          );
        }
      } else {
        // If no groups specified, use error (teacher must specify a group)
        if (teacherGroupIds.length === 0) {
          return jsonError(400, "Sizga biriktirilgan guruh topilmadi");
        }
        // For teacher with single group, default to it; otherwise require selection
        if (teacherGroupIds.length === 1) {
          uniqueGroupIds = teacherGroupIds;
        } else {
          return jsonError(400, "O'quvchi uchun guruhni tanlang");
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
          return jsonError(400, "Tanlangan guruhlardan biri topilmadi");
        }
      }
    }

    const student = await db.$transaction(async (tx) => {
      const createdStudent = await tx.student.create({
        data: normalizedStudentData,
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

    const contactName = `${normalizedStudentData.firstName} ${normalizedStudentData.lastName} ota-ona`;
    void addEskizContact(contactName, normalizedStudentData.parentPhone).catch(
      (error) => {
        console.error("Eskiz contact add failed", {
          studentId: student.id,
          parentPhone: normalizedStudentData.parentPhone,
          error,
        });
      },
    );

    return jsonSuccess(student, "O'quvchi muvaffaqiyatli qo'shildi", 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.status, error.message);
    }
    return handleApiError(error, "Students API error");
  }
}
