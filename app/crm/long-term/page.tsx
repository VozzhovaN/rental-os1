import Link from "next/link";

export default function LongTermHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Долгосрочная аренда</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Объявления (маркетинг) и договоры (реальная аренда) — разные сущности.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/crm/long-term/listings"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-400"
        >
          <h2 className="font-semibold">Объявления</h2>
          <p className="mt-1 text-sm text-zinc-500">LongTermListing — публикация и цена на витрине</p>
        </Link>
        <Link
          href="/crm/long-term/contracts"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-400"
        >
          <h2 className="font-semibold">Договоры</h2>
          <p className="mt-1 text-sm text-zinc-500">LongTermContract — начисления, платежи, задолженность</p>
        </Link>
      </div>
    </div>
  );
}
