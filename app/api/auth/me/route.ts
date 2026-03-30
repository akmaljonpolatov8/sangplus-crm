import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonSuccess } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return jsonSuccess(user, "Current user fetched successfully");
  } catch (error) {
    return handleApiError(error, "Auth me API error");
  }
}
