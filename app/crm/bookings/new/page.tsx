import Link from "next/link";
import { BookingForm } from "@/components/bookings/booking-form";
import { safeCrmPath } from "@/lib/crm-path";
import { parseDateOnly } from "@/lib/format";
import { getGuests, serializeGuest } from "@/lib/guests";
import { getProperties, getPropertyByIdOrSlug, serializeProperty } from "@/lib/properties";
import { getActiveSalesChannels, serializeSalesChannel } from "@/lib/sales-channels";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    guestId?: string;
    propertyId?: string;
    checkIn?: string;
    returnTo?: string;
  }>;
}) {
  const { guestId, propertyId, checkIn, returnTo } = await searchParams;
  const properties = (await getProperties()).map(serializeProperty);
  const guests = (await getGuests()).map(serializeGuest);
  const salesChannels = (await getActiveSalesChannels()).map(serializeSalesChannel);
  const defaultCheckIn = checkIn && parseDateOnly(checkIn) ? checkIn : undefined;
  const selectedProperty = propertyId ? await getPropertyByIdOrSlug(propertyId) : null;
  const defaultPropertyId = selectedProperty?.id;
  const backHref = safeCrmPath(returnTo) ?? "/crm/bookings";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-800">
          {safeCrmPath(returnTo) ? "← К календарю" : "← К списку броней"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новое бронирование</h1>
      </div>
      <BookingForm
        properties={properties}
        guests={guests}
        salesChannels={salesChannels}
        defaultGuestId={guestId}
        defaultPropertyId={defaultPropertyId}
        defaultCheckIn={defaultCheckIn}
        returnTo={safeCrmPath(returnTo)}
      />
    </div>
  );
}
