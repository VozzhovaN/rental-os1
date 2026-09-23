import Link from "next/link";
import { notFound } from "next/navigation";
import { CianPublicationDiagnostics } from "@/components/long-term/cian-publication-diagnostics";
import { PublicationReadinessBlock } from "@/components/long-term/publication-readiness-block";
import { PropertyObjectBlock } from "@/components/properties/property-object-block";
import { formatDateTime } from "@/lib/format";
import { longTermStatusHint, longTermStatusLabels } from "@/lib/long-term-labels";
import { getLongTermListingById, serializeLongTermListing } from "@/lib/long-term-listings";
import { publicationStatusLabels } from "@/lib/publication-labels";
import { getPublicationsForListing, serializePublication } from "@/lib/publications";
import {
  buildCianListingPreview,
  getCianPublicationDiagnostics,
} from "@/lib/publications/providers/cian";
import { validateLongTermPublicationReadiness } from "@/lib/publications/readiness";
import {
  formatArea,
  formatMoney,
  formatPercent,
  propertyTypeLabels,
} from "@/lib/property-labels";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";

export const dynamic = "force-dynamic";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export default async function LongTermCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    notFound();
  }

  const card = serializeLongTermListing(listing);
  const propertyPhotos = (await getPropertyPhotos(card.property.id)).map(serializePropertyPhoto);
  const visiblePhotos = card.photos.filter((photo) => photo.included);
  const readiness = validateLongTermPublicationReadiness(listing);
  const cianPreview = buildCianListingPreview(listing);
  const cianDiagnostics = await getCianPublicationDiagnostics(card.id);
  const publications = (await getPublicationsForListing(card.id)).map(serializePublication);
  const publicationPhone =
    card.publicationPhoneCountryCode && card.publicationPhoneNumber
      ? `+${card.publicationPhoneCountryCode} ${card.publicationPhoneNumber}`
      : null;
  const cianPublications = publications.filter(
    (publication) => publication.salesChannel.code === "CIAN",
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/long-term/listings" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← К объявлениям
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {card.marketingTitle || card.property.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Карточка долгосрочной аренды, не объект CRM</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/long-term/contracts/new?listingId=${card.id}`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
          >
            Создать договор аренды
          </Link>
          <Link
            href={`/crm/long-term/${card.id}/edit`}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            Редактировать
          </Link>
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
        propertyHref={`/crm/properties/${card.property.id}/edit`}
      />

      <PublicationReadinessBlock readiness={readiness} />

      <Block title="Контакт для публикации">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Имя</dt>
            <dd>{card.publicationContactName || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Телефон</dt>
            <dd>{publicationPhone ?? "—"}</dd>
          </div>
        </dl>
      </Block>

      <Block title="Условия аренды">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Цена в месяц</dt>
            <dd>{formatMoney(card.monthlyPrice)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Спецпредложение</dt>
            <dd>
              {card.specialOfferPrice != null ? formatMoney(card.specialOfferPrice) : "—"}
              {card.specialOfferText ? (
                <p className="mt-1 text-zinc-600">{card.specialOfferText}</p>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Залог</dt>
            <dd>{formatMoney(card.deposit)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Комиссия</dt>
            <dd>{formatPercent(card.commission)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Минимальный срок</dt>
            <dd>{card.minimumRentalPeriod} мес.</dd>
          </div>
        </dl>
        <div className="text-sm">
          <p className="text-zinc-500">Условия проживания</p>
          <p className="whitespace-pre-wrap">{card.rentalTerms || "—"}</p>
        </div>
      </Block>

      <Block title="Маркетинг">
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-zinc-500">Заголовок</p>
            <p>{card.marketingTitle || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Описание</p>
            <p className="whitespace-pre-wrap">{card.description || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Инфраструктура</p>
            <p className="whitespace-pre-wrap">{card.infrastructureDescription || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Безопасность</p>
            <p className="whitespace-pre-wrap">{card.securityDescription || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Парковка</p>
            <p className="whitespace-pre-wrap">{card.parkingDescription || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Транспорт</p>
            <p className="whitespace-pre-wrap">{card.transportDescription || "—"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Дополнительные преимущества</p>
            <p className="whitespace-pre-wrap">{card.advantagesDescription || "—"}</p>
          </div>
        </div>
      </Block>

      <Block title="Фото">
        {visiblePhotos.length === 0 ? (
          <p className="text-sm text-zinc-500">Фотографии для объявления не выбраны.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visiblePhotos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photo.url} alt="" className="h-32 w-full rounded object-cover bg-zinc-100" />
            ))}
          </div>
        )}
      </Block>

      <Block title="Статус">
        <p className="font-medium">{longTermStatusLabels[card.status]}</p>
        <p className="text-sm text-zinc-500">{longTermStatusHint[card.status]}</p>
        <p className="text-xs text-zinc-400">Обновлено {formatDateTime(card.updatedAt)}</p>
      </Block>

      <Block title="Размещения">
        {publications.length === 0 ? (
          <p className="text-sm text-zinc-500">Публикации ещё не созданы.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {publications.map((publication) => (
              <li key={publication.id} className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {publication.salesChannel.name} — {publicationStatusLabels[publication.status]}
                </span>
                {publication.lastError ? (
                  <span className="text-xs text-red-700">{publication.lastError}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {cianPublications.length > 0 ? (
          <p className="text-xs text-zinc-500">
            Запись Publication для ЦИАН есть ({cianPublications.length}). Детали фида и готовности —
            в блоке ниже.
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            Записи Publication для ЦИАН пока нет. Можно подготовить карточку к фиду из блока ЦИАН.
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-400">
          Статус площадки не меняет статус карточки. Подтверждение публикации на ЦИАН и снятие с
          публикации пока заблокированы отсутствием live-контракта.
        </p>
      </Block>

      <CianPublicationDiagnostics preview={cianPreview} diagnostics={cianDiagnostics} />
    </div>
  );
}
