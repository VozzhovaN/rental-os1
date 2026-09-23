import Link from "next/link";
import { LongTermList } from "@/components/long-term/long-term-list";
import { getLongTermListings, serializeLongTermListing } from "@/lib/long-term-listings";

export const dynamic = "force-dynamic";

export default async function LongTermListingsPage() {
  const listings = (await getLongTermListings()).map(serializeLongTermListing);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/crm/long-term" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Долгосрочная аренда
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Объявления</h1>
          <p className="mt-1 text-sm text-zinc-500">Маркетинговые карточки. Не договоры аренды.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/crm/long-term/contracts"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium"
          >
            Договоры
          </Link>
          <Link
            href="/crm/long-term/new"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Добавить объявление
          </Link>
        </div>
      </div>
      <LongTermList listings={listings} />
    </div>
  );
}
