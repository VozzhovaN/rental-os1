import { formatArea, formatMoney } from "@/lib/property-labels";
import {
  isPubliclyAccessible,
  publicPhotoUrl,
  resolveItemPrice,
  type PresentationRecord,
} from "@/lib/presentations";

export type PublicPresentationDTO = {
  token: string;
  kind: string;
  title: string;
  subtitle: string | null;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Documented: no lat/lng on Property. */
  coordinatesAvailable: false;
  items: PublicPresentationItemDTO[];
};

export type PublicPresentationItemDTO = {
  id: string;
  title: string;
  priceLabel: string | null;
  priceAmount: number | null;
  priceUnit: "day" | "month" | "sale" | "none";
  city: string;
  district: string;
  address: string;
  areaLabel: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  floor: number | null;
  totalFloors: number | null;
  description: string;
  videoUrl: string | null;
  coverPhotoUrl: string | null;
  photos: Array<{ id: string; url: string; alt: string }>;
  sections: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
  }>;
};

function priceLabel(
  amount: number | null,
  unit: "day" | "month" | "sale" | "none",
) {
  if (amount == null) return null;
  const money = formatMoney(amount);
  if (unit === "day") return `${money} / сутки`;
  if (unit === "month") return `${money} / мес.`;
  if (unit === "sale") return money;
  return money;
}

export function toPublicPresentationDTO(
  presentation: PresentationRecord,
): PublicPresentationDTO | null {
  if (!isPubliclyAccessible(presentation.status)) {
    return null;
  }

  const token = presentation.publicToken;

  return {
    token,
    kind: presentation.kind,
    title: presentation.title,
    subtitle: presentation.subtitle,
    companyName: presentation.companyName,
    contactName: presentation.contactName,
    contactPhone: presentation.contactPhone,
    contactEmail: presentation.contactEmail,
    coordinatesAvailable: false,
    items: presentation.items.map((item) => {
      const resolved = resolveItemPrice(presentation.kind, item);
      const title = item.titleOverride?.trim() || item.property.name;
      const description =
        item.descriptionOverride?.trim() ||
        item.property.shortDescription ||
        item.property.description ||
        "";

      const selectedPhotos =
        item.photos.length > 0
          ? item.photos.map((row) => row.propertyPhoto)
          : item.property.photos.slice(0, 10);

      const cover =
        (item.coverPhotoId
          ? selectedPhotos.find((p) => p.id === item.coverPhotoId) ??
            item.coverPhoto
          : null) ??
        selectedPhotos.find((p) => p.isCover) ??
        selectedPhotos[0] ??
        null;

      const orderedPhotos = cover
        ? [
            cover,
            ...selectedPhotos.filter((p) => p.id !== cover.id),
          ]
        : selectedPhotos;

      return {
        id: item.id,
        title,
        priceLabel: priceLabel(resolved.amount, resolved.unit),
        priceAmount: resolved.amount,
        priceUnit: resolved.unit,
        city: item.property.city,
        district: item.property.district,
        address: item.property.address,
        areaLabel: item.property.area != null ? formatArea(item.property.area) : null,
        rooms: item.property.rooms,
        bedrooms: item.property.bedrooms,
        bathrooms: item.property.bathrooms,
        guests: presentation.kind === "SALE" ? null : item.property.guests,
        floor: item.property.floor,
        totalFloors: item.property.totalFloors,
        description,
        videoUrl: item.videoUrl?.trim() || null,
        coverPhotoUrl: cover ? publicPhotoUrl(token, cover.id) : null,
        photos: orderedPhotos.map((photo) => ({
          id: photo.id,
          url: publicPhotoUrl(token, photo.id),
          alt: title,
        })),
        sections: item.sections
          .filter((section) => section.isVisible)
          .map((section) => ({
            id: section.id,
            type: section.type,
            title: section.title,
            content: section.content,
          })),
      };
    }),
  };
}

/** CRM serialization — still no owner/finance secrets in list DTO. */
export function serializePresentationListItem(
  presentation: Awaited<ReturnType<typeof import("@/lib/presentations").getPresentations>>[number],
) {
  return {
    id: presentation.id,
    publicToken: presentation.publicToken,
    kind: presentation.kind,
    status: presentation.status,
    title: presentation.title,
    subtitle: presentation.subtitle,
    itemCount: presentation._count.items,
    properties: presentation.items.map((item) => ({
      id: item.property.id,
      name: item.property.name,
      city: item.property.city,
    })),
    createdAt: presentation.createdAt.toISOString(),
    updatedAt: presentation.updatedAt.toISOString(),
    publishedAt: presentation.publishedAt?.toISOString() ?? null,
  };
}
