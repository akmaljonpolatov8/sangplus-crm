import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const runtime = "nodejs";

const managersQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const createManagerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(100),
  fullName: z.string().trim().min(1).max(100),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [Role.OWNER]);

    const query = managersQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      isActive: request.nextUrl.searchParams.get("isActive") ?? undefined,
    });

    const managers = await db.user.findMany({
      where: {
        role: Role.MANAGER,
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
      },
      orderBy: { fullName: "asc" },
    });

    return jsonSuccess(managers, "Managers fetched successfully");
  } catch (error) {
    return handleApiError(error, "Managers API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request, [Role.OWNER]);
    const body = await parseJson(request, createManagerSchema);

    const manager = await db.user.create({
      data: {
        username: body.username,
        fullName: body.fullName,
        role: Role.MANAGER,
        isActive: body.isActive,
        passwordHash: hashPassword(body.password),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return jsonSuccess(manager, "Manager created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Managers API error");
  }
}
