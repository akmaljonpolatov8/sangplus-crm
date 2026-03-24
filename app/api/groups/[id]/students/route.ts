import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, canAccessGroup } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const addStudentsSchema = z.object({
  studentIds: z.array(z.string()).min(1, "studentIds must not be empty"),
});

// ---------------------------------------------------------------------------
// POST /api/groups/[id]/students
// Add students to a group.  OWNER and MANAGER only.
// ---------------------------------------------------------------------------

export async function POST(
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

  const { id: groupId } = await params;

  const hasAccess = await canAccessGroup(auth.user, groupId);
  if (!hasAccess) {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json(
      { error: { message: "Group not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const parsed = addStudentsSchema.safeParse(body);
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

  const { studentIds } = parsed.data;

  await prisma.groupStudent.createMany({
    data: studentIds.map((studentId) => ({ groupId, studentId })),
    skipDuplicates: true,
  });

  const updated = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      groupStudents: {
        include: {
          student: { select: { id: true, fullName: true, status: true } },
        },
      },
      _count: { select: { groupStudents: true } },
    },
  });

  return Response.json({ data: updated }, { status: 201 });
}
