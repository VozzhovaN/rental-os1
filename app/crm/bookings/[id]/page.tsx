import { notFound } from "next/navigation";
import { BookingDetailView } from "@/components/bookings/booking-detail-view";
import { getBookingById, serializeBooking } from "@/lib/bookings";
import { getBookingFinanceState, getBookingCommissionSummary } from "@/lib/finance";
import { getGuestHistory, serializeGuestHistory } from "@/lib/guest-history";

export const dynamic = "force-dynamic";

const BOOKING_HISTORY_TYPES = new Set([
  "BOOKING_CREATED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "CHECK_IN",
  "CHECK_OUT",
]);

export default async function BookingCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookingRecord = await getBookingById(id);

  if (!bookingRecord) {
    notFound();
  }

  const booking = serializeBooking(bookingRecord);
  const finance = await getBookingFinanceState(id);
  const guestHistory = await getGuestHistory(booking.guestId);
  const propertyName = booking.property.name;
  const history = guestHistory
    .filter((entry) => {
      if (!BOOKING_HISTORY_TYPES.has(entry.type)) return false;
      const desc = entry.description ?? "";
      // Prefer events tied to this property when description is present
      if (desc && !desc.includes(propertyName)) {
        // Keep if description has date range matching this booking
        const inDate = booking.checkIn.slice(0, 10);
        const outDate = booking.checkOut.slice(0, 10);
        if (!desc.includes(inDate) && !desc.includes(outDate)) {
          return false;
        }
      }
      return true;
    })
    .map(serializeGuestHistory);

  let commission: {
    ratePercent: number | null;
    accrued: number | null;
    received: number | null;
    isOperatorOwned: boolean;
  } | null = null;

  try {
    const summary = await getBookingCommissionSummary(id);
    commission = {
      ratePercent: summary.breakdown.commissionRatePercent,
      accrued: summary.commissionAccrued,
      received: summary.commissionReceived,
      isOperatorOwned: summary.managementType === "OWN",
    };
  } catch {
    commission = null;
  }

  return (
    <BookingDetailView
      booking={booking}
      finance={finance}
      history={history}
      commission={commission}
    />
  );
}
