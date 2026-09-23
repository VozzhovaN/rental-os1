import { withApiAuth } from "@/lib/auth/with-api-auth";
import { jsonError, jsonUtf8 } from "@/lib/api-json";
import {
  deletePresentation,
  getPresentationById,
  PresentationError,
  resolveItemPrice,
  updatePresentation,
} from "@/lib/presentations";
import {
  formatZodError,
  updatePresentationSchema,
} from "@/lib/validations/presentation";

function serializeEditor(presentation: NonNullable<Awaited<ReturnType<typeof getPresentationById>>>) {
  return {
    id: presentation.id,
    publicToken: presentation.publicToken,
    kind: presentation.kind,
    status: presentation.status,
    title: presentation.title,
    subtitle: presentation.subtitle,
    companyName: presentation.companyName,
    contactName: presentation.contactName,
    contactPhone: presentation.contactPhone,
    contactEmail: presentation.contactEmail,
    internalNote: presentation.internalNote,
    publishedAt: presentation.publishedAt?.toISOString() ?? null,
    createdAt: presentation.createdAt.toISOString(),
    updatedAt: presentation.updatedAt.toISOString(),
    items: presentation.items.map((item) => {
      const price = resolveItemPrice(presentation.kind, item);
      return {
        id: item.id,
        propertyId: item.propertyId,
        propertyName: item.property.name,
        city: item.property.city,
        district: item.property.district,
        address: item.property.address,
        area: item.property.area,
        rooms: item.property.rooms,
        bedrooms: item.property.bedrooms,
        bathrooms: item.property.bathrooms,
        guests: item.property.guests,
        floor: item.property.floor,
        totalFloors: item.property.totalFloors,
        sortOrder: item.sortOrder,
        titleOverride: item.titleOverride,
        priceOverride: item.priceOverride,
        descriptionOverride: item.descriptionOverride,
        coverPhotoId: item.coverPhotoId,
        videoUrl: item.videoUrl,
        resolvedPrice: price,
        poolPhotos: item.property.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          isCover: photo.isCover,
        })),
        selectedPhotoIds: item.photos.map((row) => row.propertyPhotoId),
        sections: item.sections.map((section) => ({
          id: section.id,
          type: section.type,
          title: section.title,
          content: section.content,
          sortOrder: section.sortOrder,
          isVisible: section.isVisible,
        })),
      };
    }),
  };
}

export const GET = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const presentation = await getPresentationById(id);
  if (!presentation) {
    return jsonError("Презентация не найдена", 404, { code: "NOT_FOUND" });
  }
  return jsonUtf8({ presentation: serializeEditor(presentation) });
});

export const PATCH = withApiAuth(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = updatePresentationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const presentation = await updatePresentation(id, parsed.data);
    if (!presentation) {
      return jsonError("Презентация не найдена", 404, { code: "NOT_FOUND" });
    }
    return jsonUtf8({ presentation: serializeEditor(presentation) });
  } catch (error) {
    if (error instanceof PresentationError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "CONFLICT"
            ? 409
            : 400;
      return jsonError(error.message, status, {
        code:
          error.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : error.code === "CONFLICT"
              ? "CONFLICT"
              : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});

export const DELETE = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  try {
    await deletePresentation(id);
    return jsonUtf8({ ok: true });
  } catch (error) {
    if (error instanceof PresentationError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
