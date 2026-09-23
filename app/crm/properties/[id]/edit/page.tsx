import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/properties/property-form";
import { getPropertyByIdOrSlug, serializeProperty } from "@/lib/properties";
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

  const owners = await prisma.owner.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href={`/crm/properties/${property.id}`}
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К карточке объекта
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
          Редактирование объекта
        </h1>
        <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
          {property.name}
        </p>
      </div>
      <PropertyForm property={serializeProperty(property)} owners={owners} />
    </div>
  );
}
