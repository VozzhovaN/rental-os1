import { jsonError, jsonUtf8 } from "@/lib/api-json";
import {
  BookingError,
  bookingErrorPayload,
  bookingErrorStatus,
  deleteBooking,
  getBookingById,
  serializeBooking,
  updateBooking,
} from "@/lib/bookings";
import { updateBookingSchema } from "@/lib/validations/guest";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const booking = await getBookingById(id);

  if (!booking) {
    return jsonError("Бронирование не найдено", 404, { code: "NOT_FOUND" });
  }

  return jsonUtf8({ booking: serializeBooking(booking) });
});

export const PATCH = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = updateBookingSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const booking = await updateBooking(id, parsed.data);
    return jsonUtf8({ booking: serializeBooking(booking) });
  } catch (error) {
    if (error instanceof BookingError) {
      return jsonUtf8(bookingErrorPayload(error), { status: bookingErrorStatus(error) });
    }

    throw error;
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    await deleteBooking(id);
    return jsonUtf8({ ok: true });
  } catch (error) {
    if (error instanceof BookingError) {
      return jsonUtf8(bookingErrorPayload(error), { status: bookingErrorStatus(error) });
    }

    throw error;
  }
});
