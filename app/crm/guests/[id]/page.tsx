import { notFound } from "next/navigation";
import { GuestDetailView } from "@/components/guests/guest-detail-view";
import { getGuestBookings, serializeBooking } from "@/lib/bookings";
import { getGuestHistory, serializeGuestHistory } from "@/lib/guest-history";
import { deriveGuestUiStatus } from "@/lib/guest-status";
import { getGuestById, serializeGuest } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GuestCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guest = await getGuestById(id);

  if (!guest) {
    notFound();
  }

  const bookingsRaw = await getGuestBookings(guest.id);
  const bookings = bookingsRaw.map(serializeBooking);
  const history = (await getGuestHistory(guest.id))
    .map(serializeGuestHistory)
    .reverse();
  const uiStatus = deriveGuestUiStatus(bookingsRaw);
  const isRepeat = bookingsRaw.length > 1;

  return (
    <GuestDetailView
      guest={serializeGuest(guest)}
      bookings={bookings}
      history={history}
      uiStatus={uiStatus}
      isRepeat={isRepeat}
    />
  );
}
