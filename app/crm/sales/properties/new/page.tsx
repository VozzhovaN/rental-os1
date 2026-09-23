import Link from "next/link";
import { AddSaleForm } from "@/components/sales/add-sale-form";
import { getSaleListings } from "@/lib/sale-listings";
import { getProperties, serializeProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function NewSalePropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const [properties, listings] = await Promise.all([getProperties(), getSaleListings()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/crm/sales/properties" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К списку
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Добавить объект в продажи</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Выберите существующий Property. Дубликат SaleListing не создаётся.
        </p>
      </div>
      <AddSaleForm
        properties={properties.map(serializeProperty)}
        takenPropertyIds={listings.map((listing) => listing.propertyId)}
        defaultPropertyId={params.propertyId}
      />
    </div>
  );
}
