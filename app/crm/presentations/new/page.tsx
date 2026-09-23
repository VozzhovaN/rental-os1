import Link from "next/link";
import { CreatePresentationForm } from "@/components/presentations/create-presentation-form";
import { getProperties, serializeProperty } from "@/lib/properties";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage({
  searchParams,
}: {
  searchParams: Promise<{
    propertyId?: string;
    kind?: string;
  }>;
}) {
  const { propertyId, kind } = await searchParams;
  const properties = (await getProperties()).map(serializeProperty);

  const [ltIds, saleIds] = await Promise.all([
    prisma.longTermListing.findMany({ select: { propertyId: true } }),
    prisma.saleListing.findMany({ select: { propertyId: true } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/crm/presentations"
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К списку
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
          Новая презентация
        </h1>
      </div>
      <CreatePresentationForm
        properties={properties}
        longTermPropertyIds={ltIds.map((r) => r.propertyId)}
        salePropertyIds={saleIds.map((r) => r.propertyId)}
        initialPropertyId={propertyId}
        initialKind={
          kind === "SHORT_TERM" ||
          kind === "LONG_TERM" ||
          kind === "SALE" ||
          kind === "COLLECTION"
            ? kind
            : undefined
        }
      />
    </div>
  );
}
