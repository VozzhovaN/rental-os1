import Link from "next/link";
import { PageHeader } from "@/components/crm/page-header";
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
    <div className="space-y-5">
      <Link
        href="/crm/finance"
        className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
      >
        ← К финансам
      </Link>
      <PageHeader
        title="Собственники"
        subtitle="Расчёты и выплаты по комиссионным объектам. Баланс вычисляется из фактов."
      />
      <OwnersList owners={items} />
    </div>
  );
}
