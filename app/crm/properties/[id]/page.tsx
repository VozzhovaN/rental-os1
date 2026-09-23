import { notFound } from "next/navigation";
import { PropertyDetailView } from "@/components/properties/property-detail-view";
import { getBookings } from "@/lib/bookings";
import { calculatePropertyEconomics } from "@/lib/finance";
import { formatGuestName } from "@/lib/format";
import { getLongTermListingByPropertyId } from "@/lib/long-term-listings";
import { getPropertyByIdOrSlug, serializeProperty } from "@/lib/properties";
import {
  getPropertyPhotos,
  serializePropertyPhoto,
} from "@/lib/property-photos";
import { publicationStatusLabels } from "@/lib/publication-labels";
import { getPublicationsForListing } from "@/lib/publications";
import { prisma } from "@/lib/prisma";
import { getSaleListingByPropertyId } from "@/lib/sale-listings";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    notFound();
  }

  const [photos, longTermRaw, saleRaw, bookings, economics, owner] =
    await Promise.all([
      getPropertyPhotos(property.id),
      getLongTermListingByPropertyId(property.id),
      getSaleListingByPropertyId(property.id),
      getBookings({ propertyId: property.id }),
      calculatePropertyEconomics(property.id),
      property.ownerId
        ? prisma.owner.findUnique({
            where: { id: property.ownerId },
            select: { id: true, name: true, phone: true },
          })
        : Promise.resolve(null),
    ]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const upcomingBookings = bookings
    .filter(
      (booking) =>
        booking.status !== "CANCELLED" &&
        booking.checkOut.getTime() >= today.getTime(),
    )
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())
    .slice(0, 8)
    .map((booking) => ({
      id: booking.id,
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      status: booking.status,
      guestName: formatGuestName(booking.guest) || "Гость",
    }));

  let longTerm = null;
  if (longTermRaw) {
    const publications = await getPublicationsForListing(longTermRaw.id);
    const published = publications.filter((p) => p.status === "PUBLISHED").length;
    const summary =
      publications.length === 0
        ? "Нет публикаций"
        : `${published}/${publications.length} опубликовано` +
          (publications[0]
            ? ` · ${publicationStatusLabels[publications[0].status]}`
            : "");

    longTerm = {
      id: longTermRaw.id,
      status: longTermRaw.status,
      monthlyPrice: longTermRaw.monthlyPrice,
      deposit: longTermRaw.deposit,
      commission: longTermRaw.commission,
      minimumRentalPeriod: longTermRaw.minimumRentalPeriod,
      specialOfferPrice: longTermRaw.specialOfferPrice,
      specialOfferText: longTermRaw.specialOfferText,
      publicationSummary: summary,
    };
  }

  let sale = null;
  if (saleRaw) {
    const [interestsCount, viewingsCount, depositsCount, depositPendingCount] =
      await Promise.all([
        prisma.buyerInterest.count({ where: { saleListingId: saleRaw.id } }),
        prisma.viewing.count({
          where: { buyerInterest: { saleListingId: saleRaw.id } },
        }),
        prisma.deposit.count({
          where: { buyerInterest: { saleListingId: saleRaw.id } },
        }),
        prisma.deposit.count({
          where: {
            status: "PENDING",
            buyerInterest: { saleListingId: saleRaw.id },
          },
        }),
      ]);

    sale = {
      id: saleRaw.id,
      status: saleRaw.status,
      price: saleRaw.price,
      marketingTitle: saleRaw.marketingTitle,
      interestsCount,
      viewingsCount,
      depositsCount,
      depositPendingCount,
    };
  }

  const coverPhotos = photos.map((p) => ({
    url: p.url,
    isCover: p.isCover,
  }));

  return (
    <PropertyDetailView
      property={serializeProperty({ ...property, photos: coverPhotos })}
      photos={photos.map(serializePropertyPhoto)}
      owner={owner}
      upcomingBookings={upcomingBookings}
      longTerm={longTerm}
      sale={sale}
      finance={{
        grossRent: economics.grossRent,
        businessRevenue: economics.businessRevenue,
        totalExpenses: economics.totalExpenses,
        netProfit: economics.netProfit,
      }}
      initialTab={tab}
    />
  );
}
