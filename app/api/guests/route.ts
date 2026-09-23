import { NextResponse } from "next/server";
import {
  GuestError,
  createGuest,
  getGuests,
  serializeGuest,
  serializeGuestListItem,
} from "@/lib/guests";
import { createGuestSchema } from "@/lib/validations/guest";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const guests = (await getGuests({ q: searchParams.get("q") ?? undefined })).map(
    serializeGuestListItem,
  );
  return NextResponse.json({ guests });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createGuestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const guest = await createGuest(parsed.data);
    return NextResponse.json({ guest: serializeGuest(guest) }, { status: 201 });
  } catch (error) {
    if (error instanceof GuestError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "CONFLICT" ? 409 : 404 });
    }

    throw error;
  }
});
