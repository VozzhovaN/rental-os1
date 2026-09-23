import Link from "next/link";
import { BuyerList } from "@/components/sales/buyer-list";
import { getBuyers, serializeBuyerListItem } from "@/lib/buyers";

export const dynamic = "force-dynamic";

export default async function SalesClientsPage() {
  const buyers = (await getBuyers()).map(serializeBuyerListItem);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Продажи · Клиенты</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Покупатели контура продажи. Это не гости short-term.
          </p>
        </div>
        <Link
          href="/crm/sales/clients/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Добавить клиента
        </Link>
      </div>
      <BuyerList buyers={buyers} />
    </div>
  );
}
