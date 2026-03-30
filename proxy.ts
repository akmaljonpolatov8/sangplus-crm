import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const corsMethods = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const corsHeaders = "Content-Type, Authorization";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = isOriginAllowed(origin);
  const responseHeaders = buildCorsHeaders(origin, isAllowedOrigin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  const response = NextResponse.next();

  for (const [key, value] of Object.entries(responseHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};

function parseAllowedOrigins(value?: string) {
  if (!value) {
    return ["*"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string) {
  if (!origin) {
    return false;
  }

  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

function buildCorsHeaders(origin: string, isAllowedOrigin: boolean) {
  const allowOrigin =
    allowedOrigins.includes("*") && origin ? origin : isAllowedOrigin ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": corsMethods,
    "Access-Control-Allow-Headers": corsHeaders,
    Vary: "Origin",
    ...(allowOrigin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
  };
}
