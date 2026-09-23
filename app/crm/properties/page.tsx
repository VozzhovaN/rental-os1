import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PropertyList, type PropertyListItem } from "@/components/properties/property-list";
import { getProperties, serializeProperty } from "@/lib/properties";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const raw = await getProperties();
  const ids = raw.map((p) => p.id);

  const [longTermRows, saleRows] = ids.length
    ? await Promise.all([
        prisma.longTermListing.findMany({
          where: { propertyId: { in: ids } },
          select: { id: true, propertyId: true },
        }),
        prisma.saleListing.findMany({
          where: { propertyId: { in: ids } },
          select: { id: true, propertyId: true },
        }),
      ])
    : [[], []];

  const longTermByProperty = new Map(
    longTermRows.map((row) => [row.propertyId, row.id]),
  );
  const saleByProperty = new Map(saleRows.map((row) => [row.propertyId, row.id]));

  const properties: PropertyListItem[] = raw.map((property) => {
    const dto = serializeProperty(property);
    return {
      ...dto,
      directions: {
        longTermListingId: longTermByProperty.get(property.id) ?? null,
        saleListingId: saleByProperty.get(property.id) ?? null,
      },
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
            Объекты
          </h1>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Управление объектами недвижимости
          </p>
        </div>
        <Link
          href="/crm/properties/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <IconPlus size={16} />
          Добавить объект
        </Link>
      </div>
      <PropertyList properties={properties} />
    </div>
  );
}
