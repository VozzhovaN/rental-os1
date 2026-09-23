import Link from "next/link";
import { notFound } from "next/navigation";
import { LongTermContractFinancePanel } from "@/components/long-term/contract-finance-panel";
import { PropertyObjectBlock } from "@/components/properties/property-object-block";
import { getContractFinanceSummary } from "@/lib/finance/long-term-finance";
import { formatGuestName } from "@/lib/format";
import { formatArea, formatMoney, propertyTypeLabels } from "@/lib/property-labels";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";
import { FinanceDomainError } from "@/lib/finance";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активен",
  ENDED: "Завершён",
  CANCELLED: "Отменён",
};

export default async function LongTermContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let finance;
  try {
    finance = await getContractFinanceSummary(id);
  } catch (error) {
    if (error instanceof FinanceDomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const c = finance.contract;
  const property = await getPropertyByIdOrSlug(c.property.id);
  const propertyPhotos = (await getPropertyPhotos(c.property.id)).map(serializePropertyPhoto);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/crm/long-term/contracts" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К договорам
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Договор аренды</h1>
        <p className="text-sm text-zinc-500">{statusLabels[c.status] ?? c.status}</p>
      </div>

      {c.longTermListing?.status === "ACTIVE" && c.status === "ACTIVE" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          По объекту существует активный договор. Проверьте публикацию объявления — снятие с
          публикации не выполняется автоматически.
        </p>
      ) : null}

      {property ? (
        <PropertyObjectBlock
          property={{
            id: property.id,
            name: property.name,
            typeLabel: propertyTypeLabels[property.type],
            areaLabel: formatArea(property.area),
            city: property.city,
            address: property.address,
          }}
          photos={propertyPhotos}
          propertyHref={`/crm/properties/${property.id}`}
        />
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <p className="font-medium">{c.property.name}</p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Договор</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Арендатор</dt>
            <dd>
              <Link href={`/crm/guests/${c.guest.id}`} className="font-medium underline">
                {formatGuestName(c.guest)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Период</dt>
            <dd>
              {c.startDate.toISOString().slice(0, 10)}
              {c.endDate ? ` — ${c.endDate.toISOString().slice(0, 10)}` : " — бессрочно"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Месячная ставка</dt>
            <dd>{formatMoney(c.monthlyRent)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Депозит</dt>
            <dd>{formatMoney(c.depositAmount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Комиссия</dt>
            <dd>{(c.commissionRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</dd>
          </div>
          <div>
            <dt className="text-zinc-500">День платежа</dt>
            <dd>{c.paymentDay}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Заметки</dt>
            <dd>{c.notes || "—"}</dd>
          </div>
        </dl>
      </section>

      <LongTermContractFinancePanel contractId={c.id} status={c.status} initial={finance} />
    </div>
  );
}
