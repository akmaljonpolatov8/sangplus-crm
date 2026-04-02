import { Prisma, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

function buildGroupSelect(role: Role) {
  return {
    id: true,
    name: true,
    subject: true,
    scheduleDays: true,
    startTime: true,
    endTime: true,
    isActive: true,
    teacher: {
      select: {
        id: true,
        fullName: true,
        username: true,
      },
    },
    _count: {
      select: {
        students: {
          where: {
            leftAt: null,
          },
        },
        lessons: true,
      },
    },
    ...(role === Role.OWNER ? { monthlyFee: true } : {}),
  } satisfies Prisma.GroupSelect;
}

const groupsQuerySchema = z.object({
  search: z.string().trim().optional(),
  teacherId: z.string().cuid().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subject: z.string().trim().max(100).optional(),
  scheduleDays: z.array(z.string().trim().min(2).max(20)).min(1).max(7),
  startTime: z.string().trim().max(10).optional(),
  endTime: z.string().trim().max(10).optional(),
  monthlyFee: z.coerce.number().positive(),
  teacherId: z.string().cuid().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request, [
      Role.OWNER,
      Role.MANAGER,
      Role.TEACHER,
    ]);
    const query = groupsQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      teacherId: request.nextUrl.searchParams.get("teacherId") ?? undefined,
      isActive: request.nextUrl.searchParams.get("isActive") ?? undefined,
    });

    const groups = await db.group.findMany({
      where: {
        isActive: query.isActive,
        teacherId: actor.role === Role.TEACHER ? actor.id : query.teacherId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                {
                  teacher: {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: buildGroupSelect(actor.role),
      orderBy: { name: "asc" },
    });

    return jsonSuccess(groups, "Groups fetched successfully");
  } catch (error) {
    return handleApiError(error, "Groups API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const body = await parseJson(request, createGroupSchema);

    if (body.teacherId) {
      const teacher = await db.user.findFirst({
        where: {
          id: body.teacherId,
          role: Role.TEACHER,
          isActive: true,
        },
      });

      if (!teacher) {
        return jsonError(400, "Teacher not found");
      }
    }

    const group = await db.group.create({
      data: {
        ...body,
        monthlyFee: new Prisma.Decimal(body.monthlyFee),
      },
      select: {
        id: true,
        name: true,
        subject: true,
        scheduleDays: true,
        startTime: true,
        endTime: true,
        monthlyFee: true,
        isActive: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return jsonSuccess(group, "Group created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Groups API error");
  }
}
