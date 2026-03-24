import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson, uniqueValues } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const runtime = "nodejs";

const teachersQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const createTeacherSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(100),
  fullName: z.string().trim().min(1).max(100),
  isActive: z.boolean().default(true),
  groupIds: z.array(z.string().cuid()).default([]),
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [Role.OWNER, Role.MANAGER]);

    const query = teachersQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      isActive: request.nextUrl.searchParams.get("isActive") ?? undefined,
    });

    const teachers = await db.user.findMany({
      where: {
        role: Role.TEACHER,
        isActive: query.isActive,
        ...(query.search
          ? {
              OR: [
                { fullName: { contains: query.search, mode: "insensitive" } },
                { username: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        groups: {
          select: {
            id: true,
            name: true,
            subject: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { fullName: "asc" },
    });

    return jsonSuccess(teachers, "Teachers fetched successfully");
  } catch (error) {
    return handleApiError(error, "Teachers API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { groupIds, password, ...input } = await parseJson(request, createTeacherSchema);
    const uniqueGroupIds = uniqueValues(groupIds);

    if (uniqueGroupIds.length > 0) {
      const groupsCount = await db.group.count({
        where: {
          id: { in: uniqueGroupIds },
        },
      });

      if (groupsCount !== uniqueGroupIds.length) {
        return jsonError(400, "One or more groups do not exist");
      }
    }

    const teacher = await db.$transaction(async (tx) => {
      const createdTeacher = await tx.user.create({
        data: {
          ...input,
          role: Role.TEACHER,
          passwordHash: hashPassword(password),
        },
      });

      if (uniqueGroupIds.length > 0) {
        await tx.group.updateMany({
          where: {
            id: { in: uniqueGroupIds },
          },
          data: {
            teacherId: createdTeacher.id,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: createdTeacher.id },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          groups: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    return jsonSuccess(teacher, "Teacher created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Teachers API error");
  }
}
