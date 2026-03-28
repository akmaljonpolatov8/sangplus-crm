import { createSessionToken } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { z } from "zod";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  try {
    const { username, password } = await parseJson(request, loginSchema);

    const user = await db.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return jsonError(401, "Invalid username or password");
    }

    const token = createSessionToken(user);

    return jsonSuccess(
      {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      },
      "Login successful",
    );
  } catch (error) {
    return handleApiError(error, "Login API error");
  }
}
