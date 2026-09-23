import { NextResponse } from "next/server";

const JSON_UTF8 = "application/json; charset=utf-8";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR"
  | "INTEGRATION_ERROR";

export function jsonUtf8(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Content-Type": JSON_UTF8 },
  });
}

export function jsonError(
  message: string,
  status: number,
  extras?: { code?: ApiErrorCode; details?: string[] },
) {
  return jsonUtf8(
    {
      error: message,
      ...(extras?.code ? { code: extras.code } : {}),
      ...(extras?.details ? { details: extras.details } : {}),
    },
    { status },
  );
}
