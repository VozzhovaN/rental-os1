import { jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  BookingError,
  bookingErrorPayload,
  bookingErrorStatus,
  checkOutBooking,
  serializeBooking,
} from "@/lib/bookings";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const booking = await checkOutBooking(id);
    return jsonUtf8({ booking: serializeBooking(booking) });
  } catch (error) {
    if (error instanceof BookingError) {
      return jsonUtf8(bookingErrorPayload(error), { status: bookingErrorStatus(error) });
    }

    throw error;
  }
});
