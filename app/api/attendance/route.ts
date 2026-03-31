import { AttendanceStatus, Role } from "@prisma/client";
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
import { z } from "zod";

export const runtime = "nodejs";

const attendanceQuerySchema = z.object({
  lessonId: z.string().cuid().optional(),
  groupId: z.string().cuid().optional(),
  lessonDate: z.string().date().optional(),
});

const attendanceEntrySchema = z.object({
  studentId: z.string().cuid(),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().trim().max(500).optional(),
});

const saveAttendanceSchema = z.object({
  lessonId: z.string().cuid(),
  entries: z.array(attendanceEntrySchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const query = attendanceQuerySchema.parse({
      lessonId: request.nextUrl.searchParams.get("lessonId") ?? undefined,
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      lessonDate: request.nextUrl.searchParams.get("lessonDate") ?? undefined,
    });

    if (!query.lessonId && !query.groupId) {
      return jsonError(400, "lessonId yoki groupId majburiy");
    }

    let groupId = query.groupId;
    let lessonDate = query.lessonDate ? new Date(query.lessonDate) : undefined;

    if (query.lessonId) {
      const lesson = await db.lessonSession.findUnique({
        where: { id: query.lessonId },
        select: {
          id: true,
          groupId: true,
          lessonDate: true,
          group: {
            select: {
              teacherId: true,
            },
          },
        },
      });

      if (!lesson) {
        return jsonError(404, "Dars topilmadi");
      }

      if (actor.role === Role.TEACHER && lesson.group.teacherId !== actor.id) {
        return jsonError(
          403,
          "Siz faqat o'zingizga biriktirilgan guruhlar davomatini ko'ra olasiz",
        );
      }

      groupId = lesson.groupId;
      lessonDate = lesson.lessonDate;
    }

    if (!groupId) {
      return jsonError(400, "Guruh aniqlanmadi");
    }

    if (actor.role === Role.TEACHER) {
      const group = await db.group.findUnique({
        where: { id: groupId },
        select: { teacherId: true },
      });

      if (!group || group.teacherId !== actor.id) {
        return jsonError(
          403,
          "Siz faqat o'zingizga biriktirilgan guruhlar davomatini ko'ra olasiz",
        );
      }
    }

    const memberships = await db.groupStudent.findMany({
      where: {
        groupId,
        leftAt: null,
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
          },
        },
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
    });

    const attendance = await db.attendance.findMany({
      where: {
        lessonId: query.lessonId,
        lesson: {
          groupId,
          ...(lessonDate ? { lessonDate } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        notes: true,
        markedAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        lesson: {
          select: {
            id: true,
            lessonDate: true,
            startedAt: true,
            endedAt: true,
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        markedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { lesson: { lessonDate: "desc" } },
        { student: { lastName: "asc" } },
      ],
    });

    const attendanceByStudentId = new Map(
      attendance.map((item) => [item.student.id, item]),
    );

    const entries = memberships.map((membership) => {
      const saved = attendanceByStudentId.get(membership.student.id);

      return {
        id:
          saved?.id ??
          `${groupId}-${membership.student.id}-${lessonDate?.toISOString() ?? "current"}`,
        studentId: membership.student.id,
        studentName: `${membership.student.firstName} ${membership.student.lastName}`,
        status: saved?.status ?? null,
        notes: saved?.notes ?? null,
        markedAt: saved?.markedAt ?? null,
      };
    });

    return jsonSuccess(entries, "Davomat muvaffaqiyatli olindi");
  } catch (error) {
    return handleApiError(error, "Attendance API error");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const body = await parseJson(request, saveAttendanceSchema);
    const studentIds = body.entries.map((entry) => entry.studentId);

    if (uniqueValues(studentIds).length !== studentIds.length) {
      return jsonError(400, "Student attendance entries must be unique");
    }

    const lesson = await db.lessonSession.findUnique({
      where: { id: body.lessonId },
      select: {
        id: true,
        groupId: true,
        group: {
          select: {
            teacherId: true,
          },
        },
      },
    });

    if (!lesson) {
      return jsonError(404, "Lesson not found");
    }

    if (actor.role === Role.TEACHER && lesson.group.teacherId !== actor.id) {
      return jsonError(403, "You can mark attendance only for your groups");
    }

    const memberships = await db.groupStudent.findMany({
      where: {
        groupId: lesson.groupId,
        studentId: { in: studentIds },
        leftAt: null,
      },
      select: {
        studentId: true,
      },
    });

    if (memberships.length !== studentIds.length) {
      return jsonError(400, "One or more students do not belong to this group");
    }

    await db.$transaction(
      body.entries.map((entry) =>
        db.attendance.upsert({
          where: {
            lessonId_studentId: {
              lessonId: body.lessonId,
              studentId: entry.studentId,
            },
          },
          update: {
            status: entry.status,
            notes: entry.notes,
            markedById: actor.id,
            markedAt: new Date(),
          },
          create: {
            lessonId: body.lessonId,
            studentId: entry.studentId,
            status: entry.status,
            notes: entry.notes,
            markedById: actor.id,
          },
        }),
      ),
    );

    const attendance = await db.attendance.findMany({
      where: { lessonId: body.lessonId },
      select: {
        id: true,
        status: true,
        notes: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { student: { lastName: "asc" } },
    });

    return jsonSuccess(attendance, "Attendance saved successfully");
  } catch (error) {
    return handleApiError(error, "Attendance API error");
  }
}
