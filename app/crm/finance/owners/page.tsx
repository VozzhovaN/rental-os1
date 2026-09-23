import Link from "next/link";
import { OwnersList, type OwnerListItem } from "@/components/finance/owners-list";
import { calculateOwnerBalance, listOwners } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function FinanceOwnersPage() {
  const owners = await listOwners();
  const items: OwnerListItem[] = await Promise.all(
    owners.map(async (owner) => ({
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      isActive: owner.isActive,
      propertiesCount: owner._count.properties,
      balance: await calculateOwnerBalance(owner.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/finance" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К финансам
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Собственники</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Расчёты и выплаты по COMMISSION объектам. Баланс вычисляется из фактов.
        </p>
      </div>
      <OwnersList owners={items} />
    </div>
  );
}
