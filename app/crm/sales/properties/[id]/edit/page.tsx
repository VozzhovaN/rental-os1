import Link from "next/link";
import { notFound } from "next/navigation";
import { SaleForm } from "@/components/sales/sale-form";
import { SalePhotos } from "@/components/sales/sale-photos";
import { getSaleListingById, serializeSaleListing } from "@/lib/sale-listings";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";

export const dynamic = "force-dynamic";

export default async function EditSalePropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getSaleListingById(id);

  if (!listing) {
    notFound();
  }

  const card = serializeSaleListing(listing);
  const pool = (await getPropertyPhotos(card.propertyId)).map(serializePropertyPhoto);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/crm/sales/properties/${card.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← К карточке
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Редактирование продажи</h1>
        <p className="mt-1 text-sm text-zinc-500">{card.property.name}</p>
      </div>
      <SaleForm listing={card} />
      {card.status !== "SOLD" ? <SalePhotos listing={card} pool={pool} /> : null}
    </div>
  );
}
