import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(100),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);
    const { id } = paramsSchema.parse(await params);
    const body = await parseJson(request, resetPasswordSchema);

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    if (!user) {
      return jsonError(404, "User not found");
    }

    await db.user.update({
      where: { id },
      data: {
        passwordHash: hashPassword(body.newPassword),
      },
    });

    return jsonSuccess(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        passwordReset: true,
      },
      "User password reset successfully",
    );
  } catch (error) {
    return handleApiError(error, "Reset password API error");
  }
}
