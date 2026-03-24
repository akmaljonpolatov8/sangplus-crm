import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createStudentSchema = z.object({
  fullName: z.string().min(1, "fullName is required"),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

// ---------------------------------------------------------------------------
// GET /api/students
// Query params: search, status, groupId
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") as
    | "ACTIVE"
    | "INACTIVE"
    | undefined;
  const groupId = searchParams.get("groupId") ?? undefined;

  const students = await prisma.student.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(groupId
        ? { groupStudents: { some: { groupId } } }
        : {}),
    },
    include: {
      groupStudents: {
        include: {
          group: { select: { id: true, name: true, monthlyFeeCents: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data: students });
}

// ---------------------------------------------------------------------------
// POST /api/students
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  // Only OWNER and MANAGER can create students
  if (auth.user.role === "TEACHER") {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
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

  const parsed = createStudentSchema.safeParse(body);
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

  const student = await prisma.student.create({ data: parsed.data });

  return Response.json({ data: student }, { status: 201 });
}
