import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyObjectBlock } from "@/components/properties/property-object-block";
import { ArchiveSaleButton } from "@/components/sales/archive-sale-button";
import { SaleListingInterests } from "@/components/sales/sale-listing-interests";
import { SalePublicationPanel } from "@/components/sales/sale-publication-panel";
import {
  getBuyerInterests,
  serializeBuyerInterest,
} from "@/lib/buyer-interests";
import { getBuyers, serializeBuyer } from "@/lib/buyers";
import { listInterestHistory } from "@/lib/buyer-history";
import { getDepositsBySaleListing, serializeDeposit } from "@/lib/deposits";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatArea, formatMoney, propertyTypeLabels } from "@/lib/property-labels";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";
import { saleListingStatusHint, saleListingStatusLabels } from "@/lib/sale-listing-labels";
import { getSaleListingById, serializeSaleListing } from "@/lib/sale-listings";
import {
  getSaleListingPublicationBundle,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";
import { SALE_PUBLICATION_CHANNEL_CODES } from "@/lib/sales-channel-codes";
import {
  buildCianSaleListingPreview,
  getCianSalePublicationDiagnostics,
} from "@/lib/publications/providers/cian/sale";
import { getAvitoSalePublicationDiagnostics } from "@/lib/publications/providers/avito/sale";
import { getDomclickSalePublicationDiagnostics } from "@/lib/publications/providers/domclick/sale";
import { depositStatusLabels, viewingStatusLabels } from "@/lib/viewing-deposit-labels";
import { getViewingsBySaleListing, serializeViewing } from "@/lib/viewings";

export const dynamic = "force-dynamic";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export default async function SalePropertyCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getSaleListingById(id);

  if (!listing) {
    notFound();
  }

  const card = serializeSaleListing(listing);
  const propertyPhotos = (await getPropertyPhotos(card.property.id)).map(serializePropertyPhoto);
  const canArchive = card.status !== "ARCHIVED" && card.status !== "SOLD";
  const interests = (await getBuyerInterests({ saleListingId: id })).map(serializeBuyerInterest);
  const linkedBuyerIds = new Set(interests.map((interest) => interest.buyerId));
  const availableBuyers = (await getBuyers())
    .filter((buyer) => !linkedBuyerIds.has(buyer.id))
    .map(serializeBuyer);
  const viewings = (await getViewingsBySaleListing(id)).map(serializeViewing);
  const deposits = (await getDepositsBySaleListing(id)).map(serializeDeposit);
  const purchasedInterest = interests.find((interest) => interest.status === "PURCHASED");
  const purchaseHistory = purchasedInterest
    ? await listInterestHistory(purchasedInterest.id)
    : [];
  const purchaseCompleted = purchaseHistory.find((entry) => entry.type === "PURCHASE_COMPLETED");
  const publicationBundle = await getSaleListingPublicationBundle(id);
  const saleChannels = await prisma.salesChannel.findMany({
    where: { code: { in: [...SALE_PUBLICATION_CHANNEL_CODES] }, isActive: true },
    orderBy: { code: "asc" },
  });
  const cianPreview = buildCianSaleListingPreview(toSalePublicationListingSource(listing));
  const cianDiagnostics = await getCianSalePublicationDiagnostics(id);
  const avitoDiagnostics = await getAvitoSalePublicationDiagnostics(id);
  const domclickDiagnostics = await getDomclickSalePublicationDiagnostics(id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/sales/properties" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← К списку
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {card.marketingTitle || card.property.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Карточка продажи, не объект CRM</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Link
            href={`/crm/sales/properties/${card.id}/edit`}
            prefetch={false}
            className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Редактировать
          </Link>
          {canArchive ? <ArchiveSaleButton listingId={card.id} /> : null}
        </div>
      </div>

      <PropertyObjectBlock
        property={{
          id: card.property.id,
          name: card.property.name,
          typeLabel: propertyTypeLabels[card.property.type],
          areaLabel: formatArea(card.property.area),
          city: card.property.city,
          address: card.property.address,
        }}
        photos={propertyPhotos}
        propertyHref={`/crm/properties/${card.property.id}`}
      />

      <Block title="Продажа">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Статус</dt>
            <dd className="font-medium">{saleListingStatusLabels[card.status]}</dd>
            <p className="mt-1 text-xs text-zinc-500">{saleListingStatusHint[card.status]}</p>
            {card.status === "SOLD" && purchasedInterest ? (
              <div className="mt-3 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <p>
                  Покупатель:{" "}
                  <Link
                    href={`/crm/sales/clients/${purchasedInterest.buyerId}`}
                    className="font-medium underline"
                  >
                    {purchasedInterest.buyer.name}
                  </Link>
                </p>
                {purchaseCompleted ? (
                  <p>Дата покупки: {formatDateTime(purchaseCompleted.createdAt.toISOString())}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div>
            <dt className="text-zinc-500">Обновлено</dt>
            <dd>{formatDateTime(card.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Цена продажи</dt>
            <dd className="font-medium">{formatMoney(card.price)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Специальная цена</dt>
            <dd>
              {card.specialOfferPrice != null ? formatMoney(card.specialOfferPrice) : "—"}
              {card.specialOfferText ? (
                <p className="mt-1 text-zinc-600">{card.specialOfferText}</p>
              ) : null}
            </dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-zinc-500">Описание объекта</p>
            <p className="whitespace-pre-wrap">{card.property.description || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Комментарий CRM</p>
            <p className="whitespace-pre-wrap">{card.crmComment || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Собственник (CRM)</p>
            <p>
              {card.crmOwnerName || card.crmOwnerPhone
                ? [card.crmOwnerName, card.crmOwnerPhone].filter(Boolean).join(" · ")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Заголовок</p>
            <p>{card.marketingTitle || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Описание для публикации</p>
            <p className="whitespace-pre-wrap">{card.description || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Преимущества</p>
            <p className="whitespace-pre-wrap">{card.advantages || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Инфраструктура</p>
            <p className="whitespace-pre-wrap">{card.infrastructure || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Безопасность</p>
            <p className="whitespace-pre-wrap">{card.security || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Парковка</p>
            <p className="whitespace-pre-wrap">{card.parking || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Транспорт</p>
            <p className="whitespace-pre-wrap">{card.transport || "—"}</p>
          </div>
        </div>
      </Block>

      <Block title="Фото продажи">
        {card.photos.length === 0 ? (
          <p className="text-sm text-zinc-500">Фотографии для продажи не выбраны.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {card.photos.map((photo, index) => (
              <div key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="h-32 w-full rounded object-cover bg-zinc-100"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded bg-zinc-900/80 px-2 py-0.5 text-xs text-white">
                    Обложка
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Block>

      {publicationBundle ? (
        <SalePublicationPanel
          saleListingId={card.id}
          listingStatus={card.status}
          publications={publicationBundle.publications}
          readiness={publicationBundle.readiness}
          channels={saleChannels.map((channel) => ({
            id: channel.id,
            code: channel.code,
            name: channel.name,
          }))}
          cianPreview={cianPreview}
          cianDiagnostics={cianDiagnostics}
          avitoDiagnostics={avitoDiagnostics}
          domclickDiagnostics={domclickDiagnostics}
        />
      ) : null}

      {card.status !== "SOLD" && card.status !== "ARCHIVED" ? (
        <Block title="Клиенты / заинтересованные">
          <SaleListingInterests
            saleListingId={card.id}
            interests={interests}
            availableBuyers={availableBuyers}
          />
        </Block>
      ) : interests.length > 0 ? (
        <Block title="Клиенты / заинтересованные">
          <SaleListingInterests
            saleListingId={card.id}
            interests={interests}
            availableBuyers={[]}
          />
        </Block>
      ) : null}

      <Block title="Просмотры">
        {viewings.length === 0 ? (
          <p className="text-sm text-zinc-500">Показов по объекту пока нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {viewings.map((viewing) => (
              <li key={viewing.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {viewing.buyerName} · {formatDateTime(viewing.scheduledAt)}
                </span>
                <span>{viewingStatusLabels[viewing.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Задатки">
        {deposits.length === 0 ? (
          <p className="text-sm text-zinc-500">Задатков по объекту пока нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {deposits.map((deposit) => (
              <li key={deposit.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {deposit.buyerName} · {formatMoney(deposit.amount)}
                </span>
                <span>{depositStatusLabels[deposit.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}
