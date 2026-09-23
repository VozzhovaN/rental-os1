import { notFound } from "next/navigation";
import {
  PresentationEditor,
  type EditorPresentation,
} from "@/components/presentations/presentation-editor";
import { getPresentationById, resolveItemPrice } from "@/lib/presentations";

export const dynamic = "force-dynamic";

export default async function PresentationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const presentation = await getPresentationById(id);
  if (!presentation) notFound();

  const initial: EditorPresentation = {
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
    items: presentation.items.map((item) => ({
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
      resolvedPrice: resolveItemPrice(presentation.kind, item),
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
    })),
  };

  return <PresentationEditor initial={initial} />;
}
