import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, canAccessGroup } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const markAttendanceSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  studentId: z.string().min(1, "studentId is required"),
  status: z.enum(["PRESENT", "ABSENT", "LATE"]),
});

// ---------------------------------------------------------------------------
// POST /api/attendance/mark
// Mark attendance for a student within a lesson session.
// TEACHER: only for sessions in their assigned groups.
// OWNER/MANAGER: any session.
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

  const parsed = markAttendanceSchema.safeParse(body);
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

  const { sessionId, studentId, status } = parsed.data;

  // Verify session exists
  const session = await prisma.lessonSession.findUnique({
    where: { id: sessionId },
    select: { id: true, groupId: true },
  });

  if (!session) {
    return Response.json(
      { error: { message: "Session not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  // RBAC: TEACHER can only mark attendance for their own groups
  const hasAccess = await canAccessGroup(auth.user, session.groupId);
  if (!hasAccess) {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  // Upsert so that marking can be updated (e.g. ABSENT → PRESENT)
  const attendance = await prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    update: { status },
    create: { sessionId, studentId, status },
    include: {
      student: { select: { id: true, fullName: true } },
    },
  });

  return Response.json({ data: attendance }, { status: 200 });
}
