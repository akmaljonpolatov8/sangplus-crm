import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const patchTeacherSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/teachers/[id]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, "OWNER", "MANAGER");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, role: true } },
      groupTeachers: {
        include: {
          group: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!teacher) {
    return Response.json(
      { error: { message: "Teacher not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  return Response.json({ data: teacher });
}

// ---------------------------------------------------------------------------
// PATCH /api/teachers/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, "OWNER", "MANAGER");
  if (auth instanceof Response) return auth;

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

  const parsed = patchTeacherSchema.safeParse(body);
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

  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing) {
    return Response.json(
      { error: { message: "Teacher not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const teacher = await prisma.teacher.update({
    where: { id },
    data: parsed.data,
    include: {
      user: { select: { id: true, username: true, role: true } },
    },
  });

  return Response.json({ data: teacher });
}
