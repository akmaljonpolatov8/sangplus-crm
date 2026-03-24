import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const patchStudentSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/students/[id]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      groupStudents: {
        include: {
          group: { select: { id: true, name: true, monthlyFeeCents: true, status: true } },
        },
      },
    },
  });

  if (!student) {
    return Response.json(
      { error: { message: "Student not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  return Response.json({ data: student });
}

// ---------------------------------------------------------------------------
// PATCH /api/students/[id]
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

  const parsed = patchStudentSchema.safeParse(body);
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

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return Response.json(
      { error: { message: "Student not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const student = await prisma.student.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ data: student });
}
