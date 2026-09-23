import Link from "next/link";
import { PageHeader } from "@/components/crm/page-header";

export default function LongTermHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Долгосрочная аренда"
        subtitle="Объявления и договоры — отдельные контуры"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/crm/long-term/listings"
          className="finance-card block p-5 transition-colors hover:border-[var(--finance-blue)]/40"
        >
          <h2 className="font-semibold text-[var(--finance-text)]">Объявления</h2>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Публикация и цена на витрине
          </p>
        </Link>
        <Link
          href="/crm/long-term/contracts"
          className="finance-card block p-5 transition-colors hover:border-[var(--finance-blue)]/40"
        >
          <h2 className="font-semibold text-[var(--finance-text)]">Договоры</h2>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Начисления, платежи и задолженность
          </p>
        </Link>
      </div>
    </div>
  );
}
