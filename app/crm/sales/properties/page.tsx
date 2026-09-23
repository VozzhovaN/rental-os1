import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PageHeader } from "@/components/crm/page-header";
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
    <div className="space-y-5">
      <PageHeader
        title="Продажи"
        subtitle="Отдельный контур продажи. Объекты добавляются вручную и не влияют на Dashboard."
        actions={
          <Link
            href="/crm/sales/properties/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <IconPlus size={16} />
            Добавить объект
          </Link>
        }
      />
      <SaleList listings={listings} propertyPhotosById={propertyPhotosById} />
    </div>
  );
}
