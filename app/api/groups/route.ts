import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().min(1, "name is required"),
  monthlyFeeCents: z.number().int().min(0).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  teacherIds: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/groups
// TEACHER: only sees their assigned groups.
// OWNER/MANAGER: all groups.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { user } = auth;

  let groupWhere = {};

  if (user.role === "TEACHER") {
    // Find the teacher profile linked to this user
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });

    if (!teacher) {
      return Response.json({ data: [] });
    }

    groupWhere = {
      groupTeachers: { some: { teacherId: teacher.id } },
    };
  }

  const groups = await prisma.group.findMany({
    where: groupWhere,
    include: {
      groupTeachers: {
        include: {
          teacher: { select: { id: true, fullName: true } },
        },
      },
      _count: { select: { groupStudents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = groups.map((g) => ({
    ...g,
    studentCount: g._count.groupStudents,
  }));

  return Response.json({ data });
}

// ---------------------------------------------------------------------------
// POST /api/groups  (OWNER and MANAGER only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

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

  const parsed = createGroupSchema.safeParse(body);
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

  const { name, monthlyFeeCents, status, teacherIds } = parsed.data;

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: { name, monthlyFeeCents, status },
    });

    if (teacherIds?.length) {
      await tx.groupTeacher.createMany({
        data: teacherIds.map((teacherId) => ({ groupId: g.id, teacherId })),
        skipDuplicates: true,
      });
    }

    return tx.group.findUnique({
      where: { id: g.id },
      include: {
        groupTeachers: {
          include: { teacher: { select: { id: true, fullName: true } } },
        },
        _count: { select: { groupStudents: true } },
      },
    });
  });

  return Response.json({ data: group }, { status: 201 });
}
