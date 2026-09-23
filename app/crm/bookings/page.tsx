import Link from "next/link";
import { BookingList } from "@/components/bookings/booking-list";
import { getBookings, serializeBooking } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = (await getBookings()).map(serializeBooking);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Бронирования</h1>
          <p className="mt-1 text-sm text-zinc-500">{bookings.length} броней в базе</p>
        </div>
        <Link
          href="/crm/bookings/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Создать бронь
        </Link>
      </div>
      <BookingList bookings={bookings} />
    </div>
  );
}
