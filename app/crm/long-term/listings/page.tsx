import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PageHeader } from "@/components/crm/page-header";
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
    <div className="space-y-5">
      <Link
        href="/crm/long-term"
        className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
      >
        ← Долгосрочная аренда
      </Link>
      <PageHeader
        title="Объявления"
        subtitle="Маркетинговые карточки. Не договоры аренды."
        actions={
          <>
            <Link
              href="/crm/long-term/contracts"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Договоры
            </Link>
            <Link
              href="/crm/long-term/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <IconPlus size={16} />
              Добавить объявление
            </Link>
          </>
        }
      />
      <LongTermList
        listings={listings}
        propertyPhotosById={propertyPhotosById}
        adsByListingId={adsByListingId}
      />
    </div>
  );
}
