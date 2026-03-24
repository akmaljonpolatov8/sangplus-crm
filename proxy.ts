import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/src/lib/auth";

/**
 * Proxy (formerly middleware) protects:
 * - /api/**  – API routes (return 401 JSON), EXCEPT /api/auth/login
 * - /dashboard/** – dashboard UI routes (redirect to /login)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login endpoint without auth
  if (pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // Protect API routes
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token || !verifyJWT(token)) {
      return NextResponse.json(
        { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Protect dashboard UI routes – redirect unauthenticated users to /login
  if (pathname.startsWith("/dashboard")) {
    const token =
      request.cookies.get("token")?.value ??
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token || !verifyJWT(token)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
  ],
};
