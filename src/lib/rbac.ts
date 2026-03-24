import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getUserFromRequest, type JWTPayload } from "./auth";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = JWTPayload;

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Verify the request carries a valid JWT.
 * Returns the decoded user payload, or a 401 Response if not authenticated.
 */
export function requireAuth(
  request: NextRequest
): { user: AuthUser } | Response {
  const user = getUserFromRequest(request);
  if (!user) {
    return Response.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  return { user };
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

/**
 * Verify the authenticated user has one of the required roles.
 * Returns the user, or a 403 Response if the role check fails.
 */
export function requireRole(
  request: NextRequest,
  ...roles: Role[]
): { user: AuthUser } | Response {
  const authResult = requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;
  if (!roles.includes(user.role)) {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }
  return { user };
}

// ---------------------------------------------------------------------------
// Group access helper for TEACHER role
// ---------------------------------------------------------------------------

/**
 * Check whether a TEACHER user is assigned to a specific group.
 * OWNER and MANAGER always have access.
 */
export async function canAccessGroup(
  user: AuthUser,
  groupId: string
): Promise<boolean> {
  if (user.role === "OWNER" || user.role === "MANAGER") return true;
  if (user.role !== "TEACHER") return false;

  // Find the teacher profile for this user
  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.sub },
    select: { id: true },
  });
  if (!teacher) return false;

  const link = await prisma.groupTeacher.findUnique({
    where: { groupId_teacherId: { groupId, teacherId: teacher.id } },
  });
  return link !== null;
}

// ---------------------------------------------------------------------------
// Payment amount masking
// ---------------------------------------------------------------------------

/**
 * Strip `amountCents` from a payment object for non-OWNER users.
 * UI note: only OWNER sees the full payment amounts.
 */
export function maskPayment<
  T extends { amountCents: number; [key: string]: unknown }
>(payment: T, role: Role): Omit<T, "amountCents"> | T {
  if (role === "OWNER") return payment;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { amountCents: _omit, ...rest } = payment;
  return rest as Omit<T, "amountCents">;
}
