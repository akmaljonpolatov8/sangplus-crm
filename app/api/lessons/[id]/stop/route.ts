import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.TEACHER]);
    const { id } = paramsSchema.parse(await params);

    const lesson = await db.lessonSession.findUnique({
      where: { id },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            teacherId: true,
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

    if (!lesson) {
      return jsonError(404, "Lesson not found");
    }

    if (actor.role === Role.TEACHER && lesson.group.teacherId !== actor.id) {
      return jsonError(403, "You can stop lessons only for your groups");
    }

    if (lesson.endedAt) {
      return jsonError(409, "Lesson has already been stopped");
    }

    const updatedLesson = await db.lessonSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
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

    return jsonSuccess(
      {
        ...updatedLesson,
        durationMinutes: updatedLesson.endedAt
          ? Math.max(
              0,
              Math.round((updatedLesson.endedAt.getTime() - updatedLesson.startedAt.getTime()) / 60000),
            )
          : null,
      },
      "Lesson stopped successfully",
    );
  } catch (error) {
    return handleApiError(error, "Lesson stop API error");
  }
}
