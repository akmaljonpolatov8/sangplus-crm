import { createHmac, timingSafeEqual } from "node:crypto";
import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";

type SessionPayload = {
  sub: string;
  role: Role;
  username: string;
  exp: number;
};

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

const SESSION_TTL_SECONDS = 60 * 60 * 12;

export async function requireUser(
  request: NextRequest | Request,
  allowedRoles?: Role[],
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    throw new ApiError(401, "Authorization token is required");
  }

  const payload = verifySessionToken(token);

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, "User is not active");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ApiError(403, "You do not have access to this resource");
  }

  return user;
}

export function createSessionToken(user: {
  id: string;
  role: Role;
  username: string;
}) {
  const payload: SessionPayload = {
    sub: user.id,
    role: user.role,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return signToken(payload);
}

function signToken(payload: SessionPayload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string) {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new ApiError(401, "Invalid authorization token");
  }

  const expectedSignature = createSignature(`${header}.${payload}`);
  const incomingSignature = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    incomingSignature.length !== expectedBuffer.length ||
    !timingSafeEqual(incomingSignature, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid authorization token");
  }

  const decodedPayload = JSON.parse(base64UrlDecode(payload)) as SessionPayload;

  if (decodedPayload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "Authorization token has expired");
  }

  return decodedPayload;
}

function createSignature(input: string) {
  return createHmac("sha256", getAuthSecret()).update(input).digest("base64url");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new ApiError(500, "AUTH_SECRET is not configured");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
