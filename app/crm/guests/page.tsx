import Link from "next/link";
import { GuestList } from "@/components/guests/guest-list";
import { getGuests, serializeGuestListItem } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const guests = (await getGuests()).map(serializeGuestListItem);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Гости</h1>
          <p className="mt-1 text-sm text-zinc-500">{guests.length} гостей в базе</p>
        </div>
        <Link
          href="/crm/guests/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Добавить гостя
        </Link>
      </div>
      <GuestList guests={guests} />
    </div>
  );
}
