import { Role } from "@prisma/client";
import { createSessionToken } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const runtime = "nodejs";

const bootstrapOwnerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(100),
  fullName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const usersCount = await db.user.count();

    if (usersCount > 0) {
      return jsonError(403, "Owner has already been initialized");
    }

    const body = await parseJson(request, bootstrapOwnerSchema);

    const owner = await db.user.create({
      data: {
        username: body.username,
        fullName: body.fullName,
        role: Role.OWNER,
        isActive: true,
        passwordHash: hashPassword(body.password),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
      },
    });

    return jsonSuccess(
      {
        token: createSessionToken(owner),
        user: owner,
      },
      "Owner account created successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error, "Bootstrap owner API error");
  }
}
