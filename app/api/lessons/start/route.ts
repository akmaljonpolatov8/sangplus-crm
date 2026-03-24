import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, parseJson } from "@/lib/api";
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
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    if (actor.role === Role.TEACHER && group.teacherId !== actor.id) {
      return Response.json({ error: "You can start lessons only for your groups" }, { status: 403 });
    }

    const lesson = await db.lessonSession.upsert({
      where: {
        groupId_lessonDate: {
          groupId: body.groupId,
          lessonDate: normalizedLessonDate,
        },
      },
      update: {
        notes: body.notes,
      },
      create: {
        groupId: body.groupId,
        startedById: actor.id,
        lessonDate: normalizedLessonDate,
        notes: body.notes,
      },
      select: {
        id: true,
        lessonDate: true,
        startedAt: true,
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

    return Response.json({ data: lesson }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Lesson start API error");
  }
}
