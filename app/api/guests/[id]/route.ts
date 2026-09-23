import { NextResponse } from "next/server";
import {
  GuestError,
  deleteGuest,
  getGuestById,
  serializeGuest,
  updateGuest,
} from "@/lib/guests";
import { updateGuestSchema } from "@/lib/validations/guest";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const guest = await getGuestById(id);

  if (!guest) {
    return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
  }

  return NextResponse.json({ guest: serializeGuest(guest) });
});

export const PATCH = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateGuestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const guest = await updateGuest(id, parsed.data);
    return NextResponse.json({ guest: serializeGuest(guest) });
  } catch (error) {
    if (error instanceof GuestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "CONFLICT" ? 409 : 404 },
      );
    }

    throw error;
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    await deleteGuest(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GuestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "CONFLICT" ? 409 : 404 },
      );
    }

    throw error;
  }
});
