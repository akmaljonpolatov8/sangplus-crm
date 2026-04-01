import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return jsonSuccess(user, "Current user fetched successfully");
  } catch (error) {
    return handleApiError(error, "Auth me API error");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const body = await parseJson(request, updateProfileSchema);

    const updatedUser = await db.user.update({
      where: { id: actor.id },
      data: {
        fullName: body.fullName,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    return jsonSuccess(updatedUser, "Profile updated successfully");
  } catch (error) {
    return handleApiError(error, "Auth me API error");
  }
}
