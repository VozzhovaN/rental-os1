import { jsonError, jsonUtf8 } from "@/lib/api-json";
import type { BookingStatus } from "@prisma/client";
import {
  BookingError,
  bookingErrorPayload,
  bookingErrorStatus,
  createBooking,
  getBookings,
  serializeBooking,
} from "@/lib/bookings";
import { BOOKING_STATUSES, createBookingSchema } from "@/lib/validations/guest";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (status && !BOOKING_STATUSES.includes(status as BookingStatus)) {
    return jsonError("Некорректный статус", 400, { code: "VALIDATION_ERROR" });
  }

  const bookings = (
    await getBookings({
      propertyId: searchParams.get("propertyId") ?? undefined,
      guestId: searchParams.get("guestId") ?? undefined,
      salesChannelId: searchParams.get("salesChannelId") ?? undefined,
      status: (status as BookingStatus | null) ?? undefined,
    })
  ).map(serializeBooking);

  return jsonUtf8({ bookings });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const booking = await createBooking(parsed.data);
    return jsonUtf8({ booking: serializeBooking(booking) }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingError) {
      return jsonUtf8(bookingErrorPayload(error), { status: bookingErrorStatus(error) });
    }

    throw error;
  }
});
