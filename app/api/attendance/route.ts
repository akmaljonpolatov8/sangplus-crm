import { AttendanceStatus, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson, uniqueValues } from "@/lib/api";
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
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER, Role.TEACHER]);
    const query = attendanceQuerySchema.parse({
      lessonId: request.nextUrl.searchParams.get("lessonId") ?? undefined,
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      lessonDate: request.nextUrl.searchParams.get("lessonDate") ?? undefined,
    });

    const attendance = await db.attendance.findMany({
      where: {
        lessonId: query.lessonId,
        lesson: {
          groupId: query.groupId,
          ...(query.lessonDate ? { lessonDate: new Date(query.lessonDate) } : {}),
          ...(actor.role === Role.TEACHER
            ? {
                group: {
                  teacherId: actor.id,
                },
              }
            : {}),
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
      orderBy: [{ lesson: { lessonDate: "desc" } }, { student: { lastName: "asc" } }],
    });

    return jsonSuccess(attendance, "Attendance fetched successfully");
  } catch (error) {
    return handleApiError(error, "Attendance API error");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.TEACHER]);
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
