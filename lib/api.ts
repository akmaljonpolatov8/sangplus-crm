import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function jsonSuccess<T>(
  data: T,
  message = "Request completed successfully",
  status = 200,
) {
  return Response.json(
    {
      success: true,
      message,
      data,
      error: null,
    },
    { status },
  );
}

export function jsonError(status: number, message: string, details?: unknown) {
  return Response.json(
    {
      success: false,
      message,
      data: null,
      error: details === undefined ? message : { message, details },
    },
    { status },
  );
}

export function handleApiError(error: unknown, label = "API error") {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return jsonError(400, "Validation failed", error.flatten().fieldErrors);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2002" ? 409 : 400;
    return jsonError(status, "Database request failed", {
      code: error.code,
      label,
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error(label, error);
    return jsonError(500, "Database connection failed", {
      code: "PRISMA_INIT_ERROR",
      label,
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return jsonError(400, "Invalid database request", {
      code: "PRISMA_VALIDATION_ERROR",
      label,
    });
  }

  console.error(label, error);
  return jsonError(500, "Internal server error");
}

export async function parseJson<T>(
  request: Request,
  parser: { parse: (input: unknown) => T },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }

  return parser.parse(body);
}

export function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}
