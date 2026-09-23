import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PageHeader } from "@/components/crm/page-header";
import { BuyerList } from "@/components/sales/buyer-list";
import { getBuyers, serializeBuyerListItem } from "@/lib/buyers";

export const dynamic = "force-dynamic";

export default async function SalesClientsPage() {
  const buyers = (await getBuyers()).map(serializeBuyerListItem);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Клиенты"
        subtitle="Покупатели контура продажи. Это не гости посуточной аренды."
        actions={
          <Link
            href="/crm/sales/clients/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <IconPlus size={16} />
            Добавить клиента
          </Link>
        }
      />
      <BuyerList buyers={buyers} />
    </div>
  );
}
