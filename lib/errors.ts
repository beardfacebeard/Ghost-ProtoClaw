import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden") {
  return new AppError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Not found") {
  return new AppError(message, 404, "NOT_FOUND");
}

export function badRequest(message = "Bad request") {
  return new AppError(message, 400, "BAD_REQUEST");
}

export function conflict(message = "Conflict") {
  return new AppError(message, 409, "CONFLICT");
}

export function serverError(message = "Internal server error") {
  return new AppError(message, 500, "SERVER_ERROR");
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: error.message,
          code: error.code
        },
        { status: error.statusCode }
      )
    );
  }

  if (error instanceof ZodError) {
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "Validation failed",
          issues: error.issues
        },
        { status: 400 }
      )
    );
  }

  console.error("Unhandled API error", error);
  return addSecurityHeaders(
    NextResponse.json(
      {
        error: "Something went wrong. Please try again.",
        code: "SERVER_ERROR"
      },
      { status: 500 }
    )
  );
}
