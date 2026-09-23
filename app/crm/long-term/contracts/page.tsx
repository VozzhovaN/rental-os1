import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PageHeader } from "@/components/crm/page-header";
import { listLongTermContracts, getContractFinanceSummary } from "@/lib/finance/long-term-finance";
import { formatMoney } from "@/lib/property-labels";
import { formatGuestName } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активен",
  ENDED: "Завершён",
  CANCELLED: "Отменён",
};

export default async function LongTermContractsPage() {
  const contracts = await listLongTermContracts();
  const rows = await Promise.all(
    contracts.map(async (c) => {
      const finance = await getContractFinanceSummary(c.id);
      return { c, summary: finance.summary };
    }),
  );

  return (
    <div className="space-y-5">
      <Link
        href="/crm/long-term"
        className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
      >
        ← Долгосрочная аренда
      </Link>
      <PageHeader
        title="Договоры"
        subtitle="Договоры аренды, начисления и платежи"
        actions={
          <>
            <Link
              href="/crm/long-term/listings"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Объявления
            </Link>
            <Link
              href="/crm/long-term/contracts/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <IconPlus size={16} />
              Новый договор
            </Link>
          </>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Объект</th>
              <th className="px-3 py-2 font-medium">Арендатор</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Начало</th>
              <th className="px-3 py-2 font-medium">Ставка</th>
              <th className="px-3 py-2 font-medium">Начислено</th>
              <th className="px-3 py-2 font-medium">Оплачено</th>
              <th className="px-3 py-2 font-medium">Долг</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  Договоров пока нет
                </td>
              </tr>
            ) : (
              rows.map(({ c, summary }) => (
                <tr key={c.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2">
                    <Link href={`/crm/long-term/contracts/${c.id}`} className="font-medium underline">
                      {c.property.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{formatGuestName(c.guest)}</td>
                  <td className="px-3 py-2">{statusLabels[c.status] ?? c.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.startDate.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">{formatMoney(c.monthlyRent)}</td>
                  <td className="px-3 py-2">{formatMoney(summary.rentAccrued)}</td>
                  <td className="px-3 py-2">{formatMoney(summary.rentPaid)}</td>
                  <td className="px-3 py-2">{formatMoney(Math.max(0, summary.rentOutstanding))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
