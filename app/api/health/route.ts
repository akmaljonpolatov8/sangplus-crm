import { Prisma } from "@prisma/client";
import { handleApiError, jsonSuccess } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw(Prisma.sql`SELECT 1`);

    return jsonSuccess(
      {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      },
      "Health check passed",
    );
  } catch (error) {
    return handleApiError(error, "Health API error");
  }
}
