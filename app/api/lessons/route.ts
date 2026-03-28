import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const lessonsQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  lessonDate: z.string().date().optional(),
  activeOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const createLessonSchema = z.object({
  groupId: z.string().cuid(),
  lessonDate: z.string().date(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const query = lessonsQuerySchema.parse({
      groupId: request.nextUrl.searchParams.get("groupId") ?? undefined,
      teacherId: request.nextUrl.searchParams.get("teacherId") ?? undefined,
      lessonDate: request.nextUrl.searchParams.get("lessonDate") ?? undefined,
      activeOnly: request.nextUrl.searchParams.get("activeOnly") ?? undefined,
    });

    const lessons = await db.lessonSession.findMany({
      where: {
        groupId: query.groupId,
        lessonDate: query.lessonDate ? new Date(query.lessonDate) : undefined,
        endedAt: query.activeOnly ? null : undefined,
        group: {
          teacherId: actor.role === Role.TEACHER ? actor.id : query.teacherId,
        },
      },
      select: {
        id: true,
        lessonDate: true,
        startedAt: true,
        endedAt: true,
        notes: true,
        group: {
          select: {
            id: true,
            name: true,
            subject: true,
            scheduleDays: true,
            startTime: true,
            endTime: true,
          },
        },
        startedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        _count: {
          select: {
            attendance: true,
          },
        },
      },
      orderBy: [{ lessonDate: "desc" }, { startedAt: "desc" }],
    });

    return jsonSuccess(
      lessons.map((lesson) => ({
        ...lesson,
        durationMinutes: lesson.endedAt
          ? Math.max(
              0,
              Math.round(
                (lesson.endedAt.getTime() - lesson.startedAt.getTime()) / 60000,
              ),
            )
          : null,
      })),
      "Lessons fetched successfully",
    );
  } catch (error) {
    return handleApiError(error, "Lessons API error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const body = await request.json();
    const payload = createLessonSchema.parse(body);

    const group = await db.group.findUnique({
      where: { id: payload.groupId },
      select: { id: true, teacherId: true },
    });

    if (!group) {
      return handleApiError(new Error("Group not found"), "Lessons API error");
    }

    if (actor.role === Role.TEACHER && group.teacherId !== actor.id) {
      return handleApiError(new Error("Unauthorized"), "Lessons API error");
    }

    const existingLesson = await db.lessonSession.findFirst({
      where: {
        groupId: payload.groupId,
        lessonDate: new Date(payload.lessonDate),
      },
      select: { id: true },
    });

    if (existingLesson) {
      return jsonSuccess(existingLesson, "Lesson already exists");
    }

    const created = await db.lessonSession.create({
      data: {
        groupId: payload.groupId,
        lessonDate: new Date(payload.lessonDate),
        startedAt: new Date(),
        startedById: actor.id,
      },
      select: {
        id: true,
        groupId: true,
        lessonDate: true,
        startedAt: true,
      },
    });

    return jsonSuccess(created, "Lesson created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Lessons create API error");
  }
}
