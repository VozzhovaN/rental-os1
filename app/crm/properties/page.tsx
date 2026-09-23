import Link from "next/link";
import { PropertyList } from "@/components/properties/property-list";
import { getProperties, serializeProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = (await getProperties()).map(serializeProperty);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Объекты недвижимости
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {properties.length} объектов в базе
          </p>
        </div>
        <Link
          href="/crm/properties/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Добавить объект
        </Link>
      </div>
      <PropertyList properties={properties} />
    </div>
  );
}
