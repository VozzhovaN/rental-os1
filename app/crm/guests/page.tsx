import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { GuestList } from "@/components/guests/guest-list";
import { buildGuestListKpi } from "@/lib/guest-kpi";
import { getGuests, serializeGuestListItem } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const guests = (await getGuests()).map(serializeGuestListItem);
  const kpi = buildGuestListKpi(guests);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
            Гости
          </h1>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            База гостей и история проживания
          </p>
        </div>
        <Link
          href="/crm/guests/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <IconPlus size={16} />
          Добавить гостя
        </Link>
      </div>
      <GuestList guests={guests} kpi={kpi} />
    </div>
  );
}
