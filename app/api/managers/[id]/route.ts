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

const updateManagerSchema = z.object({
  username: z.string().trim().min(3).max(50).optional(),
  password: z.string().min(6).max(100).optional(),
  fullName: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { id } = paramsSchema.parse(await params);
    const body = await parseJson(request, updateManagerSchema);

    const manager = await db.user.findFirst({
      where: {
        id,
        role: Role.MANAGER,
      },
      select: { id: true },
    });

    if (!manager) {
      return jsonError(404, "Manager not found");
    }

    const updatedManager = await db.user.update({
      where: { id },
      data: {
        username: body.username,
        fullName: body.fullName,
        isActive: body.isActive,
        ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return jsonSuccess(updatedManager, "Manager updated successfully");
  } catch (error) {
    return handleApiError(error, "Manager detail API error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request, [Role.OWNER]);

    const { id } = paramsSchema.parse(await params);

    const manager = await db.user.findFirst({
      where: {
        id,
        role: Role.MANAGER,
      },
      select: { id: true },
    });

    if (!manager) {
      return jsonError(404, "Manager not found");
    }

    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    return jsonSuccess(
      {
        id,
        deleted: true,
      },
      "Manager deleted successfully",
    );
  } catch (error) {
    return handleApiError(error, "Manager detail API error");
  }
}
