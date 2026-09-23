import Link from "next/link";
import { notFound } from "next/navigation";
import { LongTermForm } from "@/components/long-term/long-term-form";
import { LongTermPhotos } from "@/components/long-term/long-term-photos";
import { getLongTermListingById, serializeLongTermListing } from "@/lib/long-term-listings";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";

export const dynamic = "force-dynamic";

export default async function EditLongTermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    notFound();
  }

  const card = serializeLongTermListing(listing);
  const pool = (await getPropertyPhotos(card.propertyId)).map(serializePropertyPhoto);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/crm/long-term/${card.id}`} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К карточке
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Редактирование объявления</h1>
        <p className="mt-1 text-sm text-zinc-500">{card.property.name}</p>
      </div>
      <LongTermForm listing={card} />
      <LongTermPhotos listing={card} pool={pool} />
    </div>
  );
}
