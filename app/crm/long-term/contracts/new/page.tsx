import Link from "next/link";
import { CreateContractForm } from "@/components/long-term/create-contract-form";
import { prisma } from "@/lib/prisma";
import { formatGuestName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewLongTermContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const listingId = typeof sp.listingId === "string" ? sp.listingId : undefined;

  const [properties, guests, listing] = await Promise.all([
    prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.guest.findMany({
      select: { id: true, firstName: true, lastName: true, middleName: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    listingId
      ? prisma.longTermListing.findUnique({
          where: { id: listingId },
          select: { id: true, propertyId: true, monthlyPrice: true, deposit: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/long-term/contracts" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К договорам
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новый договор</h1>
      </div>
      <CreateContractForm
        properties={properties.map((p) => ({ id: p.id, label: p.name }))}
        guests={guests.map((g) => ({ id: g.id, label: formatGuestName(g) }))}
        prefill={
          listing
            ? {
                propertyId: listing.propertyId,
                longTermListingId: listing.id,
                monthlyRent: listing.monthlyPrice,
                depositAmount: listing.deposit,
                paymentDay: 5,
              }
            : undefined
        }
      />
    </div>
  );
}
