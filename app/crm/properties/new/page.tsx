import Link from "next/link";
import { PropertyForm } from "@/components/properties/property-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const owners = await prisma.owner.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });

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
          Новый объект
        </h1>
      </div>
      <PropertyForm owners={owners} />
    </div>
  );
}
