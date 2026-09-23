import Link from "next/link";
import { LongTermList } from "@/components/long-term/long-term-list";
import { isFloorPlanCaption } from "@/lib/sale-photo-labels";
import { prisma } from "@/lib/prisma";
import { getLongTermListings, serializeLongTermListing } from "@/lib/long-term-listings";
import { publicationStatusLabels } from "@/lib/publication-labels";

export const dynamic = "force-dynamic";

export default async function LongTermListingsPage() {
  const listings = (await getLongTermListings()).map(serializeLongTermListing);
  const propertyIds = listings.map((listing) => listing.propertyId);
  const listingIds = listings.map((listing) => listing.id);

  const propertyPhotos =
    propertyIds.length > 0
      ? await prisma.propertyPhoto.findMany({
          where: { propertyId: { in: propertyIds } },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
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

  const publications =
    listingIds.length > 0
      ? await prisma.publication.findMany({
          where: { longTermListingId: { in: listingIds } },
          include: { salesChannel: { select: { code: true, name: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : [];

  const adsByListingId: Record<string, { label: string; published: boolean }> = {};
  for (const listingId of listingIds) {
    adsByListingId[listingId] = { label: "Не опубликовано", published: false };
  }
  for (const publication of publications) {
    const current = adsByListingId[publication.longTermListingId];
    if (!current) continue;
    if (publication.status === "PUBLISHED") {
      const channelName = publication.salesChannel.name;
      if (!current.published) {
        adsByListingId[publication.longTermListingId] = {
          label: channelName,
          published: true,
        };
      } else if (!current.label.includes(channelName)) {
        adsByListingId[publication.longTermListingId] = {
          label: `${current.label}, ${channelName}`,
          published: true,
        };
      }
    } else if (!current.published && current.label === "Не опубликовано") {
      adsByListingId[publication.longTermListingId] = {
        label: publicationStatusLabels[publication.status] ?? publication.status,
        published: false,
      };
    }
  }

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
      <LongTermList
        listings={listings}
        propertyPhotosById={propertyPhotosById}
        adsByListingId={adsByListingId}
      />
    </div>
  );
}
