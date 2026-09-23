import { NextResponse } from "next/server";
import { createGuestHistory, getGuestHistory, serializeGuestHistory } from "@/lib/guest-history";
import { getGuestById } from "@/lib/guests";
import { createGuestHistorySchema } from "@/lib/validations/guest";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const guest = await getGuestById(id);

  if (!guest) {
    return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
  }

  const history = (await getGuestHistory(guest.id)).map(serializeGuestHistory);
  return NextResponse.json({ history });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const guest = await getGuestById(id);

  if (!guest) {
    return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createGuestHistorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const entry = await createGuestHistory({
    guestId: guest.id,
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description,
  });

  return NextResponse.json({ history: serializeGuestHistory(entry) }, { status: 201 });
});
