import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, canAccessGroup } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const patchGroupSchema = z.object({
  name: z.string().min(1).optional(),
  monthlyFeeCents: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  teacherIds: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/groups/[id]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const hasAccess = await canAccessGroup(auth.user, id);
  if (!hasAccess) {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      groupTeachers: {
        include: {
          teacher: { select: { id: true, fullName: true, phone: true } },
        },
      },
      groupStudents: {
        include: {
          student: { select: { id: true, fullName: true, phone: true, status: true } },
        },
      },
      _count: { select: { groupStudents: true, sessions: true } },
    },
  });

  if (!group) {
    return Response.json(
      { error: { message: "Group not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  return Response.json({ data: group });
}

// ---------------------------------------------------------------------------
// PATCH /api/groups/[id]  (OWNER and MANAGER only)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  if (auth.user.role === "TEACHER") {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const parsed = patchGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing) {
    return Response.json(
      { error: { message: "Group not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const { teacherIds, ...groupFields } = parsed.data;

  const group = await prisma.$transaction(async (tx) => {
    const updated = await tx.group.update({
      where: { id },
      data: groupFields,
    });

    // If teacherIds provided, replace the teacher assignments
    if (teacherIds !== undefined) {
      await tx.groupTeacher.deleteMany({ where: { groupId: id } });
      if (teacherIds.length) {
        await tx.groupTeacher.createMany({
          data: teacherIds.map((teacherId) => ({ groupId: id, teacherId })),
          skipDuplicates: true,
        });
      }
    }

    return tx.group.findUnique({
      where: { id: updated.id },
      include: {
        groupTeachers: {
          include: { teacher: { select: { id: true, fullName: true } } },
        },
        _count: { select: { groupStudents: true } },
      },
    });
  });

  return Response.json({ data: group });
}
