import { NextResponse } from "next/server";
import { getGuestBookings, serializeBooking } from "@/lib/bookings";
import { getGuestById } from "@/lib/guests";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const guest = await getGuestById(id);

  if (!guest) {
    return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
  }

  const bookings = (await getGuestBookings(guest.id)).map(serializeBooking);
  return NextResponse.json({ bookings });
});
