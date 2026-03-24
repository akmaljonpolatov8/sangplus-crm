import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, canAccessGroup } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const startSessionSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
});

// ---------------------------------------------------------------------------
// POST /api/sessions/start
// Start a lesson session for a group.
// TEACHER: only for their assigned groups.
// OWNER/MANAGER: any group.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const parsed = startSessionSchema.safeParse(body);
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

  const { groupId } = parsed.data;

  // RBAC: TEACHER can only start sessions for their own groups
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

  const session = await prisma.lessonSession.create({
    data: {
      groupId,
      startedByUserId: auth.user.sub,
    },
    include: {
      group: { select: { id: true, name: true } },
      startedBy: { select: { id: true, username: true } },
    },
  });

  return Response.json({ data: session }, { status: 201 });
}
