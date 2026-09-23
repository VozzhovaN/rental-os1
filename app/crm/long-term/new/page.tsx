import Link from "next/link";
import { AddLongTermForm } from "@/components/long-term/add-long-term-form";
import { getLongTermListings } from "@/lib/long-term-listings";
import { getProperties, serializeProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function NewLongTermPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const [properties, listings] = await Promise.all([getProperties(), getLongTermListings()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/crm/long-term" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К списку
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Добавить в долгосрочную аренду</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Выберите существующий объект. Копия Property не создаётся.
        </p>
      </div>
      <AddLongTermForm
        properties={properties.map(serializeProperty)}
        takenPropertyIds={listings.map((listing) => listing.propertyId)}
        defaultPropertyId={params.propertyId}
      />
    </div>
  );
}
