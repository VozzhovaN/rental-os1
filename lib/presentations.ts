import { randomBytes } from "crypto";
import type {
  Presentation,
  PresentationItem,
  PresentationKind,
  PresentationSection,
  PresentationSectionType,
  PresentationStatus,
  Property,
  PropertyPhoto,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class PresentationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "PresentationError";
  }
}

export const PRESENTATION_KINDS = [
  "SHORT_TERM",
  "LONG_TERM",
  "SALE",
  "COLLECTION",
] as const;

export const PRESENTATION_STATUSES = [
  "DRAFT",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const PRESENTATION_SECTION_TYPES = [
  "DESCRIPTION",
  "ADVANTAGES",
  "INFRASTRUCTURE",
  "AMENITIES",
  "LOCATION",
  "CONDITIONS",
  "LAYOUT",
  "COMMUNICATIONS",
  "SECURITY",
  "CUSTOM",
] as const;

export const MAX_ITEMS = 5;
export const MAX_PHOTOS_PER_ITEM = 10;

/** Documented gaps for Stage 12.6.4. */
export const PROPERTY_VIDEO_STORAGE_GAP =
  "PROPERTY_VIDEO_STORAGE_GAP: video URL optional; no video storage pipeline.";
export const PROPERTY_COORDINATES_GAP =
  "PROPERTY_COORDINATES_GAP: Property has no latitude/longitude; map embed disabled.";

void PROPERTY_VIDEO_STORAGE_GAP;
void PROPERTY_COORDINATES_GAP;

export function createPublicToken() {
  return randomBytes(24).toString("base64url");
}

export function isPubliclyAccessible(status: PresentationStatus) {
  return status === "READY" || status === "PUBLISHED";
}

const defaultSectionsByKind: Record<
  PresentationKind,
  Array<{ type: PresentationSectionType; title: string }>
> = {
  SHORT_TERM: [
    { type: "DESCRIPTION", title: "Об объекте" },
    { type: "ADVANTAGES", title: "Преимущества" },
    { type: "AMENITIES", title: "Удобства" },
    { type: "INFRASTRUCTURE", title: "Инфраструктура" },
    { type: "CONDITIONS", title: "Условия проживания" },
    { type: "LOCATION", title: "Расположение" },
  ],
  LONG_TERM: [
    { type: "DESCRIPTION", title: "Об объекте" },
    { type: "ADVANTAGES", title: "Преимущества" },
    { type: "INFRASTRUCTURE", title: "Инфраструктура" },
    { type: "CONDITIONS", title: "Условия" },
    { type: "LOCATION", title: "Расположение" },
  ],
  SALE: [
    { type: "DESCRIPTION", title: "Об объекте" },
    { type: "ADVANTAGES", title: "Преимущества" },
    { type: "INFRASTRUCTURE", title: "Инфраструктура" },
    { type: "LAYOUT", title: "Планировка" },
    { type: "SECURITY", title: "Безопасность" },
    { type: "LOCATION", title: "Расположение" },
  ],
  COLLECTION: [
    { type: "DESCRIPTION", title: "Об объекте" },
    { type: "ADVANTAGES", title: "Преимущества" },
    { type: "INFRASTRUCTURE", title: "Инфраструктура" },
    { type: "LOCATION", title: "Расположение" },
  ],
};

const presentationInclude = {
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      property: {
        include: {
          longTermListing: true,
          saleListing: true,
          photos: {
            orderBy: [
              { isCover: "desc" as const },
              { sortOrder: "asc" as const },
              { createdAt: "asc" as const },
            ],
          },
        },
      },
      coverPhoto: true,
      photos: {
        orderBy: { sortOrder: "asc" as const },
        include: { propertyPhoto: true },
      },
      sections: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

export type PresentationRecord = Presentation & {
  items: Array<
    PresentationItem & {
      property: Property & {
        longTermListing: {
          id: string;
          monthlyPrice: number;
          description: string;
          marketingTitle: string;
          advantagesDescription: string;
          infrastructureDescription: string;
          rentalTerms: string;
          parkingDescription: string;
          securityDescription: string;
        } | null;
        saleListing: {
          id: string;
          price: number;
          marketingTitle: string | null;
          description: string | null;
          advantages: string | null;
          infrastructure: string | null;
          security: string | null;
        } | null;
        photos: PropertyPhoto[];
      };
      coverPhoto: PropertyPhoto | null;
      photos: Array<{
        id: string;
        sortOrder: number;
        propertyPhotoId: string;
        propertyPhoto: PropertyPhoto;
      }>;
      sections: PresentationSection[];
    }
  >;
};

export async function getPresentations() {
  return prisma.presentation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          property: { select: { id: true, name: true, city: true } },
        },
      },
      _count: { select: { items: true } },
    },
  });
}

export async function getPresentationById(id: string) {
  return prisma.presentation.findUnique({
    where: { id },
    include: presentationInclude,
  }) as Promise<PresentationRecord | null>;
}

export async function getPresentationByPublicToken(token: string) {
  return prisma.presentation.findUnique({
    where: { publicToken: token },
    include: presentationInclude,
  }) as Promise<PresentationRecord | null>;
}

function seedSectionContent(
  type: PresentationSectionType,
  property: PresentationRecord["items"][number]["property"],
  kind: PresentationKind,
): string {
  const lt = property.longTermListing;
  const sale = property.saleListing;

  switch (type) {
    case "DESCRIPTION":
      if (kind === "LONG_TERM" && lt?.description) return lt.description;
      if (kind === "SALE" && sale?.description) return sale.description;
      return property.description || property.shortDescription || "";
    case "ADVANTAGES":
      if (kind === "LONG_TERM" && lt?.advantagesDescription) {
        return lt.advantagesDescription;
      }
      if (kind === "SALE" && sale?.advantages) return sale.advantages;
      return "";
    case "INFRASTRUCTURE":
      if (kind === "LONG_TERM" && lt?.infrastructureDescription) {
        return lt.infrastructureDescription;
      }
      if (kind === "SALE" && sale?.infrastructure) return sale.infrastructure;
      return "";
    case "CONDITIONS":
      return lt?.rentalTerms || "";
    case "SECURITY":
      return lt?.securityDescription || sale?.security || "";
    case "LOCATION":
      return [property.city, property.district, property.address]
        .filter(Boolean)
        .join(", ");
    default:
      return "";
  }
}

export type CreatePresentationInput = {
  kind: PresentationKind;
  propertyIds: string[];
  title?: string;
  subtitle?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export async function createPresentation(input: CreatePresentationInput) {
  const ids = [...new Set(input.propertyIds.filter(Boolean))];
  if (ids.length < 1 || ids.length > MAX_ITEMS) {
    throw new PresentationError(
      `Выберите от 1 до ${MAX_ITEMS} объектов`,
      "VALIDATION",
    );
  }

  if (input.kind !== "COLLECTION" && ids.length > 1) {
    // multi-property of same kind is allowed (comparison within kind)
  }

  const properties = await prisma.property.findMany({
    where: { id: { in: ids } },
    include: {
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
      longTermListing: true,
      saleListing: true,
    },
  });

  if (properties.length !== ids.length) {
    throw new PresentationError("Один или несколько объектов не найдены", "NOT_FOUND");
  }

  for (const property of properties) {
    if (input.kind === "LONG_TERM" && !property.longTermListing) {
      throw new PresentationError(
        `Для «${property.name}» нет карточки долгосрочной аренды`,
        "VALIDATION",
      );
    }
    if (input.kind === "SALE" && !property.saleListing) {
      throw new PresentationError(
        `Для «${property.name}» нет карточки продажи`,
        "VALIDATION",
      );
    }
  }

  const ordered = ids.map((id) => properties.find((p) => p.id === id)!);
  const defaultTitle =
    input.title?.trim() ||
    (ordered.length === 1
      ? ordered[0]!.name
      : `Подборка · ${ordered.length} объектов`);

  const presentation = await prisma.presentation.create({
    data: {
      publicToken: createPublicToken(),
      kind: input.kind,
      status: "DRAFT",
      title: defaultTitle,
      subtitle: input.subtitle ?? "Подобрано специально для вас",
      companyName: input.companyName ?? "Rental OS",
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      items: {
        create: ordered.map((property, index) => {
          const photoIds = property.photos
            .slice(0, MAX_PHOTOS_PER_ITEM)
            .map((p) => p.id);
          const coverId =
            property.photos.find((p) => p.isCover)?.id ??
            property.photos[0]?.id ??
            null;
          const sectionDefs = defaultSectionsByKind[input.kind];

          return {
            propertyId: property.id,
            sortOrder: index,
            titleOverride:
              input.kind === "SALE"
                ? property.saleListing?.marketingTitle || null
                : input.kind === "LONG_TERM"
                  ? property.longTermListing?.marketingTitle || null
                  : null,
            coverPhotoId: coverId,
            photos: {
              create: photoIds.map((propertyPhotoId, photoIndex) => ({
                propertyPhotoId,
                sortOrder: photoIndex,
              })),
            },
            sections: {
              create: sectionDefs.map((section, sectionIndex) => ({
                type: section.type,
                title: section.title,
                content: seedSectionContent(section.type, property as never, input.kind),
                sortOrder: sectionIndex,
                isVisible: true,
              })),
            },
          };
        }),
      },
    },
    include: presentationInclude,
  });

  return presentation as PresentationRecord;
}

export type UpdatePresentationInput = {
  title?: string;
  subtitle?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  internalNote?: string | null;
  status?: PresentationStatus;
  items?: Array<{
    id: string;
    titleOverride?: string | null;
    priceOverride?: number | null;
    descriptionOverride?: string | null;
    coverPhotoId?: string | null;
    videoUrl?: string | null;
    sortOrder?: number;
    photoIds?: string[];
    sections?: Array<{
      id?: string;
      type: PresentationSectionType;
      title: string;
      content: string;
      sortOrder: number;
      isVisible: boolean;
    }>;
  }>;
};

export async function updatePresentation(
  id: string,
  input: UpdatePresentationInput,
) {
  const current = await getPresentationById(id);
  if (!current) {
    throw new PresentationError("Презентация не найдена", "NOT_FOUND");
  }

  if (input.status === "ARCHIVED" && current.status === "ARCHIVED") {
    // ok
  }

  if (input.status && input.status !== current.status) {
    assertStatusTransition(current.status, input.status);
  }

  await prisma.$transaction(async (tx) => {
    await tx.presentation.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle === undefined ? undefined : input.subtitle,
        companyName:
          input.companyName === undefined ? undefined : input.companyName,
        contactName:
          input.contactName === undefined ? undefined : input.contactName,
        contactPhone:
          input.contactPhone === undefined ? undefined : input.contactPhone,
        contactEmail:
          input.contactEmail === undefined ? undefined : input.contactEmail,
        internalNote:
          input.internalNote === undefined ? undefined : input.internalNote,
        status: input.status,
        publishedAt:
          input.status === "PUBLISHED" || input.status === "READY"
            ? current.publishedAt ?? new Date()
            : input.status === "DRAFT" || input.status === "ARCHIVED"
              ? null
              : undefined,
      },
    });

    if (!input.items) return;

    for (const item of input.items) {
      const existing = current.items.find((row) => row.id === item.id);
      if (!existing) {
        throw new PresentationError("Элемент презентации не найден", "NOT_FOUND");
      }

      if (item.coverPhotoId) {
        const ok = await tx.propertyPhoto.findFirst({
          where: { id: item.coverPhotoId, propertyId: existing.propertyId },
        });
        if (!ok) {
          throw new PresentationError(
            "Обложка должна принадлежать объекту",
            "VALIDATION",
          );
        }
      }

      if (item.photoIds) {
        if (item.photoIds.length > MAX_PHOTOS_PER_ITEM) {
          throw new PresentationError(
            `Не более ${MAX_PHOTOS_PER_ITEM} фотографий на объект`,
            "VALIDATION",
          );
        }
        const photos = await tx.propertyPhoto.findMany({
          where: {
            id: { in: item.photoIds },
            propertyId: existing.propertyId,
          },
        });
        if (photos.length !== item.photoIds.length) {
          throw new PresentationError(
            "Можно выбирать только фотографии объекта",
            "VALIDATION",
          );
        }
        await tx.presentationItemPhoto.deleteMany({
          where: { presentationItemId: item.id },
        });
        await tx.presentationItemPhoto.createMany({
          data: item.photoIds.map((propertyPhotoId, sortOrder) => ({
            presentationItemId: item.id,
            propertyPhotoId,
            sortOrder,
          })),
        });
      }

      await tx.presentationItem.update({
        where: { id: item.id },
        data: {
          titleOverride:
            item.titleOverride === undefined ? undefined : item.titleOverride,
          priceOverride:
            item.priceOverride === undefined ? undefined : item.priceOverride,
          descriptionOverride:
            item.descriptionOverride === undefined
              ? undefined
              : item.descriptionOverride,
          coverPhotoId:
            item.coverPhotoId === undefined ? undefined : item.coverPhotoId,
          videoUrl: item.videoUrl === undefined ? undefined : item.videoUrl,
          sortOrder: item.sortOrder,
        },
      });

      if (item.sections) {
        await tx.presentationSection.deleteMany({
          where: { presentationItemId: item.id },
        });
        await tx.presentationSection.createMany({
          data: item.sections.map((section) => ({
            presentationItemId: item.id,
            type: section.type,
            title: section.title.trim() || "Раздел",
            content: section.content ?? "",
            sortOrder: section.sortOrder,
            isVisible: section.isVisible,
          })),
        });
      }
    }
  });

  return getPresentationById(id);
}

function assertStatusTransition(
  from: PresentationStatus,
  to: PresentationStatus,
) {
  const allowed: Record<PresentationStatus, PresentationStatus[]> = {
    DRAFT: ["READY", "PUBLISHED", "ARCHIVED"],
    READY: ["DRAFT", "PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["READY", "ARCHIVED", "DRAFT"],
    ARCHIVED: ["DRAFT"],
  };
  if (!allowed[from].includes(to)) {
    throw new PresentationError(
      `Нельзя перевести статус из ${from} в ${to}`,
      "VALIDATION",
    );
  }
}

export async function deletePresentation(id: string) {
  const current = await prisma.presentation.findUnique({ where: { id } });
  if (!current) {
    throw new PresentationError("Презентация не найдена", "NOT_FOUND");
  }
  await prisma.presentation.delete({ where: { id } });
  return true;
}

export function resolveItemPrice(
  kind: PresentationKind,
  item: PresentationRecord["items"][number],
): { amount: number | null; unit: "day" | "month" | "sale" | "none" } {
  if (item.priceOverride != null && item.priceOverride > 0) {
    if (kind === "SALE") return { amount: item.priceOverride, unit: "sale" };
    if (kind === "LONG_TERM") return { amount: item.priceOverride, unit: "month" };
    if (kind === "SHORT_TERM") return { amount: item.priceOverride, unit: "day" };
    return { amount: item.priceOverride, unit: "none" };
  }

  if (kind === "SALE") {
    const price = item.property.saleListing?.price ?? null;
    return { amount: price && price > 0 ? price : null, unit: "sale" };
  }
  if (kind === "LONG_TERM") {
    const price = item.property.longTermListing?.monthlyPrice ?? null;
    return { amount: price && price > 0 ? price : null, unit: "month" };
  }
  if (kind === "SHORT_TERM") {
    const price = item.property.dailyPrice ?? null;
    return { amount: price && price > 0 ? price : null, unit: "day" };
  }

  // COLLECTION: prefer sale → LT → daily
  if (item.property.saleListing?.price && item.property.saleListing.price > 0) {
    return { amount: item.property.saleListing.price, unit: "sale" };
  }
  if (
    item.property.longTermListing?.monthlyPrice &&
    item.property.longTermListing.monthlyPrice > 0
  ) {
    return { amount: item.property.longTermListing.monthlyPrice, unit: "month" };
  }
  if (item.property.dailyPrice && item.property.dailyPrice > 0) {
    return { amount: item.property.dailyPrice, unit: "day" };
  }
  return { amount: null, unit: "none" };
}

export function publicPhotoUrl(token: string, photoId: string) {
  return `/api/p/${token}/photos/${photoId}`;
}
