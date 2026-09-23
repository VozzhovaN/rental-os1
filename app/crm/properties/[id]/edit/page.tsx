import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyChannels } from "@/components/properties/property-channels";
import { PropertyForm } from "@/components/properties/property-form";
import { PropertyPhotoGallery } from "@/components/properties/property-photo-gallery";
import { getPropertyByIdOrSlug, serializeProperty } from "@/lib/properties";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    notFound();
  }

  const [owners, photos] = await Promise.all([
    prisma.owner.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    getPropertyPhotos(property.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/crm/properties"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← К списку объектов
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Редактирование объекта
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{property.name}</p>
      </div>
      <PropertyPhotoGallery
        propertyId={property.id}
        initialPhotos={photos.map(serializePropertyPhoto)}
      />
      <PropertyChannels propertyId={property.id} />
      <PropertyForm property={serializeProperty(property)} owners={owners} />
    </div>
  );
}
