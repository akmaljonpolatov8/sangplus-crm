import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { strongPasswordSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(100),
  newPassword: strongPasswordSchema,
});

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    const body = await parseJson(request, changePasswordSchema);

    if (body.currentPassword === body.newPassword) {
      return jsonError(400, "New password must be different from current password");
    }

    const user = await db.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
      return jsonError(400, "Current password is incorrect");
    }

    await db.user.update({
      where: { id: actor.id },
      data: {
        passwordHash: hashPassword(body.newPassword),
      },
    });

    return jsonSuccess(
      {
        id: actor.id,
        passwordChanged: true,
      },
      "Password changed successfully",
    );
  } catch (error) {
    return handleApiError(error, "Change password API error");
  }
}
