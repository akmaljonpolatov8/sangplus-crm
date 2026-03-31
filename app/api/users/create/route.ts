import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { strongPasswordSchema, usernameSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const createUserSchema = z.object({
  username: usernameSchema,
  password: strongPasswordSchema,
  fullName: z.string().trim().min(1).max(100),
  role: z.nativeEnum(Role).default(Role.TEACHER),
});

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request, [Role.OWNER, Role.MANAGER]);
    const body = await parseJson(request, createUserSchema);

    if (actor.role === Role.MANAGER && body.role !== Role.TEACHER) {
      return jsonError(403, "Menejer faqat o'qituvchi loginini yarata oladi");
    }

    const created = await db.user.create({
      data: {
        username: body.username,
        fullName: body.fullName,
        role: body.role,
        isActive: true,
        passwordHash: hashPassword(body.password),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    return jsonSuccess(created, "Login muvaffaqiyatli yaratildi", 201);
  } catch (error) {
    return handleApiError(error, "Users create API error");
  }
}
