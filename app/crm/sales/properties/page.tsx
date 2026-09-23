import Link from "next/link";
import { SaleList } from "@/components/sales/sale-list";
import { isFloorPlanCaption } from "@/lib/sale-photo-labels";
import { prisma } from "@/lib/prisma";
import { getSaleListings, serializeSaleListing } from "@/lib/sale-listings";

export const dynamic = "force-dynamic";

export default async function SalesPropertiesPage() {
  const listings = (await getSaleListings()).map(serializeSaleListing);
  const propertyIds = listings.map((listing) => listing.propertyId);
  const propertyPhotos =
    propertyIds.length > 0
      ? await prisma.propertyPhoto.findMany({
          where: { propertyId: { in: propertyIds } },
          orderBy: { sortOrder: "asc" },
          select: { id: true, propertyId: true, url: true, caption: true },
        })
      : [];

  const propertyPhotosById: Record<
    string,
    Array<{ id: string; url: string; caption: string | null; isFloorPlan: boolean }>
  > = {};

  for (const photo of propertyPhotos) {
    const list = propertyPhotosById[photo.propertyId] ?? [];
    list.push({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      isFloorPlan: isFloorPlanCaption(photo.caption),
    });
    propertyPhotosById[photo.propertyId] = list;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Продажи</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Отдельный контур продажи. Объекты добавляются вручную и не влияют на Dashboard.
          </p>
        </div>
        <Link
          href="/crm/sales/properties/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Добавить объект в продажи
        </Link>
      </div>
      <SaleList listings={listings} propertyPhotosById={propertyPhotosById} />
    </div>
  );
}
