import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/** Hash a plain-text password with bcrypt (cost factor 12). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Compare a plain-text password against a bcrypt hash. */
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export interface JWTPayload {
  sub: string; // user id
  username: string;
  role: Role;
}

/** Return the JWT secret; throws at call-time if not configured. */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. Add it to your .env file."
    );
  }
  return secret;
}

/** Sign a JWT for the given user payload. Expires in 7 days by default. */
export function signJWT(
  payload: JWTPayload,
  expiresIn: string | number = "7d"
): string {
  return jwt.sign(payload, getJWTSecret(), { expiresIn } as jwt.SignOptions);
}

/** Verify and decode a JWT. Returns null if invalid/expired. */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJWTSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Extract and verify the JWT from the Authorization header
 * (`Bearer <token>`).  Returns the decoded payload or null.
 */
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyJWT(token);
}
