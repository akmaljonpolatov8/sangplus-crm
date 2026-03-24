import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";
import { hashPassword } from "@/src/lib/auth";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createTeacherSchema = z.object({
  fullName: z.string().min(1, "fullName is required"),
  phone: z.string().optional(),
  // Login credentials for the teacher's User record
  username: z.string().min(3, "username must be at least 3 characters"),
  password: z.string().min(6, "password must be at least 6 characters"),
});

// ---------------------------------------------------------------------------
// GET /api/teachers  (OWNER and MANAGER only)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireRole(request, "OWNER", "MANAGER");
  if (auth instanceof Response) return auth;

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { id: true, username: true, role: true } },
      groupTeachers: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data: teachers });
}

// ---------------------------------------------------------------------------
// POST /api/teachers  (OWNER and MANAGER only)
// Creates a User with role=TEACHER and a linked Teacher profile.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "OWNER", "MANAGER");
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

  const parsed = createTeacherSchema.safeParse(body);
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

  const { fullName, phone, username, password } = parsed.data;

  // Check username uniqueness
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return Response.json(
      { error: { message: "Username already taken", code: "CONFLICT" } },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  // Create user + teacher in a transaction
  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, passwordHash, role: "TEACHER" },
    });
    return tx.teacher.create({
      data: { fullName, phone, userId: user.id },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });
  });

  return Response.json({ data: teacher }, { status: 201 });
}
