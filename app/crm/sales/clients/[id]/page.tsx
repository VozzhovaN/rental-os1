import Link from "next/link";
import { notFound } from "next/navigation";
import { AddInterestForm } from "@/components/sales/add-interest-form";
import { BuyerDepositsPanel } from "@/components/sales/buyer-deposits-panel";
import { BuyerHistoryTimeline } from "@/components/sales/buyer-history-timeline";
import { BuyerInterestPanel } from "@/components/sales/buyer-interest-panel";
import { BuyerViewingsPanel } from "@/components/sales/buyer-viewings-panel";
import { getBuyerById, serializeBuyer } from "@/lib/buyers";
import {
  getBuyerInterests,
  serializeBuyerInterest,
} from "@/lib/buyer-interests";
import { listBuyerHistory, serializeBuyerHistory } from "@/lib/buyer-history";
import { getDepositsByInterest, serializeDeposit } from "@/lib/deposits";
import { messengerTypeLabels } from "@/lib/guest-labels";
import { getSaleListings, serializeSaleListing } from "@/lib/sale-listings";
import { getViewingsByInterest, serializeViewing } from "@/lib/viewings";

export const dynamic = "force-dynamic";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export default async function SalesClientCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const buyer = await getBuyerById(id);
  if (!buyer) {
    notFound();
  }

  const card = serializeBuyer(buyer);
  const interests = (await getBuyerInterests({ buyerId: id })).map(serializeBuyerInterest);
  const linkedIds = new Set(interests.map((interest) => interest.saleListingId));
  const availableListings = (await getSaleListings())
    .filter(
      (listing) =>
        listing.status !== "SOLD" &&
        listing.status !== "ARCHIVED" &&
        !linkedIds.has(listing.id),
    )
    .map(serializeSaleListing);

  const viewingsNested = await Promise.all(
    interests.map((interest) => getViewingsByInterest(interest.id)),
  );
  const viewings = viewingsNested.flat().map(serializeViewing);
  const depositsNested = await Promise.all(
    interests.map((interest) => getDepositsByInterest(interest.id)),
  );
  const deposits = depositsNested.flat().map(serializeDeposit);
  const history = (await listBuyerHistory(id)).map(serializeBuyerHistory);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/sales/clients" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← К списку
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{card.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">Клиент контура продажи</p>
        </div>
        <Link
          href={`/crm/sales/clients/${card.id}/edit`}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Редактировать
        </Link>
      </div>

      <Block title="Контакты">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Телефон</dt>
            <dd>{card.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd>{card.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Мессенджер</dt>
            <dd>
              {card.messengerType
                ? `${messengerTypeLabels[card.messengerType]}${
                    card.messengerContact ? ` · ${card.messengerContact}` : ""
                  }`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Заметки</dt>
            <dd className="whitespace-pre-wrap">{card.notes || "—"}</dd>
          </div>
        </dl>
      </Block>

      <Block title="Интересующие объекты">
        <div className="mb-4">
          <AddInterestForm buyerId={card.id} listings={availableListings} />
        </div>
        <BuyerInterestPanel interests={interests} />
      </Block>

      <Block title="Просмотры">
        <BuyerViewingsPanel interests={interests} viewings={viewings} />
      </Block>

      <Block title="Задатки">
        <BuyerDepositsPanel interests={interests} deposits={deposits} />
      </Block>

      <Block title="История">
        <BuyerHistoryTimeline buyerId={card.id} history={history} />
      </Block>
    </div>
  );
}
