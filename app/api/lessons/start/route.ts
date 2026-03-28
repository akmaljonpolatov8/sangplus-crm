import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const startLessonSchema = z.object({
  groupId: z.string().cuid(),
  lessonDate: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.TEACHER]);
    const body = await parseJson(request, startLessonSchema);
    const lessonDate = body.lessonDate ? new Date(body.lessonDate) : new Date();
    const normalizedLessonDate = new Date(
      Date.UTC(lessonDate.getUTCFullYear(), lessonDate.getUTCMonth(), lessonDate.getUTCDate()),
    );

    const group = await db.group.findUnique({
      where: { id: body.groupId },
      select: {
        id: true,
        teacherId: true,
        name: true,
      },
    });

    if (!group) {
      return jsonError(404, "Group not found");
    }

    if (actor.role === Role.TEACHER && group.teacherId !== actor.id) {
      return jsonError(403, "You can start lessons only for your groups");
    }

    const existingLesson = await db.lessonSession.findUnique({
      where: {
        groupId_lessonDate: {
          groupId: body.groupId,
          lessonDate: normalizedLessonDate,
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
          },
        },
        startedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (existingLesson) {
      const lesson = body.notes
        ? await db.lessonSession.update({
            where: { id: existingLesson.id },
            data: { notes: body.notes },
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
                },
              },
              startedBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          })
        : existingLesson;

      return jsonSuccess(lesson, "Lesson already exists for this date");
    }

    const lesson = await db.lessonSession.create({
      data: {
        groupId: body.groupId,
        startedById: actor.id,
        lessonDate: normalizedLessonDate,
        notes: body.notes,
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
          },
        },
        startedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return jsonSuccess(lesson, "Lesson started successfully", 201);
  } catch (error) {
    return handleApiError(error, "Lesson start API error");
  }
}
