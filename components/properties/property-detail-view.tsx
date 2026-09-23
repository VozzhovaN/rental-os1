"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconBuilding, IconPlus } from "@/components/crm/icons";
import { PropertyChannels } from "@/components/properties/property-channels";
import { PropertyPhotoGallery } from "@/components/properties/property-photo-gallery";
import { dashboardHref } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { longTermStatusLabels } from "@/lib/long-term-labels";
import type { PropertyPhotoDTO } from "@/lib/property-photos";
import type { PropertyDTO } from "@/lib/properties";
import {
  formatArea,
  formatMoney,
  formatPercent,
  managementTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/lib/property-labels";
import { saleListingStatusLabels } from "@/lib/sale-listing-labels";

export type PropertyDetailBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guestName: string;
};

export type PropertyDetailLongTerm = {
  id: string;
  status: keyof typeof longTermStatusLabels;
  monthlyPrice: number;
  deposit: number;
  commission: number;
  minimumRentalPeriod: number;
  specialOfferPrice: number | null;
  specialOfferText: string | null;
  publicationSummary: string;
};

export type PropertyDetailSale = {
  id: string;
  status: keyof typeof saleListingStatusLabels;
  price: number;
  marketingTitle: string | null;
  interestsCount: number;
  viewingsCount: number;
  depositsCount: number;
  depositPendingCount: number;
};

export type PropertyDetailFinance = {
  grossRent: number;
  businessRevenue: number;
  totalExpenses: number;
  netProfit: number;
};

export type PropertyDetailOwner = {
  id: string;
  name: string;
  phone: string | null;
} | null;

type TabId =
  | "overview"
  | "photos"
  | "short-term"
  | "long-term"
  | "sales"
  | "finance"
  | "integrations";

const statusBadgeClass = {
  ACTIVE: "bg-[var(--finance-green-light)] text-[var(--finance-green)]",
  INACTIVE: "bg-[#F1F5F9] text-[#64748B]",
  ARCHIVED: "bg-[#FFF7ED] text-[#C2410C]",
} as const;

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="finance-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--finance-text)]">
        {value}
      </dd>
    </div>
  );
}

function HeaderMenu({
  propertyId,
  longTermId,
  saleId,
}: {
  propertyId: string;
  longTermId: string | null;
  saleId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const calendarHref = dashboardHref({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    date: now.toISOString().slice(0, 10),
    propertyId,
  });

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = [
    { href: calendarHref, label: "Открыть календарь" },
    { href: `/crm/finance/properties/${propertyId}`, label: "Финансы объекта" },
    {
      href: `/crm/presentations/new?propertyId=${propertyId}&kind=SHORT_TERM`,
      label: "Презентация · посуточно",
    },
  ];
  if (longTermId) {
    items.push({ href: `/crm/long-term/${longTermId}`, label: "Открыть долгосрок" });
    items.push({
      href: `/crm/presentations/new?propertyId=${propertyId}&kind=LONG_TERM`,
      label: "Презентация · долгосрок",
    });
  } else {
    items.push({
      href: `/crm/long-term/new?propertyId=${propertyId}`,
      label: "Настроить долгосрок",
    });
  }
  if (saleId) {
    items.push({ href: `/crm/sales/properties/${saleId}`, label: "Открыть продажу" });
    items.push({
      href: `/crm/presentations/new?propertyId=${propertyId}&kind=SALE`,
      label: "Презентация · продажа",
    });
  } else {
    items.push({
      href: `/crm/sales/properties/new?propertyId=${propertyId}`,
      label: "Добавить в продажи",
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Дополнительные действия"
        title="Дополнительные действия"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white text-[#64748B] hover:bg-[var(--finance-hover)]"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--finance-border)] bg-white py-1 shadow-[var(--finance-shadow)]"
        >
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              role="menuitem"
              className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DangerZone({ property }: { property: PropertyDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Удалить объект «${property.name}»? Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось удалить объект");
      }
      router.push("/crm/properties");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить объект",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="finance-card border-[var(--finance-red-light)] p-4 sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-red)]">
        Опасная зона
      </h2>
      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">
        Удаление возможно только без бронирований, каналов и карточки
        долгосрочной аренды. Ограничения backend не обходятся.
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-[var(--finance-red-light)] px-3 py-2 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending}
        className="mt-4 rounded-xl border border-[var(--finance-red)]/30 px-4 py-2 text-sm font-medium text-[var(--finance-red)] hover:bg-[var(--finance-red-light)] disabled:opacity-50"
      >
        {pending ? "Удаление..." : "Удалить объект"}
      </button>
    </section>
  );
}

export function PropertyDetailView({
  property,
  photos,
  owner,
  upcomingBookings,
  longTerm,
  sale,
  finance,
  initialTab,
}: {
  property: PropertyDTO;
  photos: PropertyPhotoDTO[];
  owner: PropertyDetailOwner;
  upcomingBookings: PropertyDetailBooking[];
  longTerm: PropertyDetailLongTerm | null;
  sale: PropertyDetailSale | null;
  finance: PropertyDetailFinance;
  initialTab?: string;
}) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Обзор" },
    { id: "photos", label: "Фотографии" },
    { id: "short-term", label: "Посуточная аренда" },
    { id: "long-term", label: "Долгосрок" },
    { id: "sales", label: "Продажа" },
    { id: "finance", label: "Финансы" },
    { id: "integrations", label: "Интеграции" },
  ];

  const resolvedInitial =
    tabs.find((t) => t.id === initialTab)?.id ?? ("overview" as TabId);
  const [tab, setTab] = useState<TabId>(resolvedInitial);

  const cover =
    photos.find((p) => p.isCover) ?? photos[0] ?? null;
  const thumbs = photos.filter((p) => p.id !== cover?.id).slice(0, 4);

  const now = new Date();
  const calendarHref = dashboardHref({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    date: now.toISOString().slice(0, 10),
    propertyId: property.id,
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm/properties"
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К списку объектов
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
              {property.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
              {property.city}
              {property.district ? `, ${property.district}` : ""} ·{" "}
              {property.address}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/crm/properties/${property.id}/edit`}
              className="inline-flex rounded-xl border border-[var(--finance-border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Редактировать
            </Link>
            <Link
              href={`/crm/bookings/new?propertyId=${property.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <IconPlus size={16} />
              Новая бронь
            </Link>
            <Link
              href={`/crm/presentations/new?propertyId=${property.id}&kind=SHORT_TERM`}
              className="inline-flex rounded-xl border border-[var(--finance-border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Создать презентацию
            </Link>
            <HeaderMenu
              propertyId={property.id}
              longTermId={longTerm?.id ?? null}
              saleId={sale?.id ?? null}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="finance-card overflow-hidden">
          <div className="aspect-[16/10] bg-[#EEF3F9]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt={property.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[#94A3B8]">
                <IconBuilding size={40} />
              </div>
            )}
          </div>
          {thumbs.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5 p-2">
              {thumbs.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={photo.url}
                  alt=""
                  className="aspect-[4/3] rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="finance-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[property.status]}`}
            >
              {propertyStatusLabels[property.status]}
            </span>
            <span className="inline-flex rounded-md bg-[var(--finance-blue-light)] px-2 py-0.5 text-[11px] font-medium text-[var(--finance-blue)]">
              {property.managementType === "OWN"
                ? "Собственный объект"
                : "Объект в управлении"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label="Тип" value={propertyTypeLabels[property.type]} />
            <Fact label="Площадь" value={formatArea(property.area)} />
            <Fact label="Комнаты" value={property.rooms} />
            <Fact label="Спальни" value={property.bedrooms} />
            <Fact label="Ванные" value={property.bathrooms} />
            <Fact
              label="Этаж"
              value={
                property.floor != null
                  ? property.totalFloors != null
                    ? `${property.floor} / ${property.totalFloors}`
                    : property.floor
                  : "—"
              }
            />
            <Fact label="Гостей" value={property.guests} />
            <Fact label="Посуточно" value={formatMoney(property.dailyPrice)} />
            <Fact
              label="Управление"
              value={managementTypeLabels[property.managementType]}
            />
          </dl>
        </div>
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--finance-border)] bg-white p-1"
        role="tablist"
        aria-label="Разделы объекта"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-[10px] px-3 py-2 text-sm font-medium whitespace-nowrap ${
              tab === item.id
                ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                : "text-[#64748B] hover:bg-[var(--finance-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Основные данные">
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Тип" value={propertyTypeLabels[property.type]} />
              <Fact
                label="Статус"
                value={propertyStatusLabels[property.status]}
              />
              <Fact label="Город" value={property.city} />
              <Fact label="Район" value={property.district || "—"} />
              <Fact label="Адрес" value={property.address} />
              <Fact label="Площадь" value={formatArea(property.area)} />
            </dl>
          </SectionCard>
          <SectionCard title="Управление">
            <dl className="grid grid-cols-2 gap-3">
              <Fact
                label="Тип"
                value={
                  property.managementType === "OWN"
                    ? "Собственный объект"
                    : "Объект в управлении"
                }
              />
              <Fact
                label="Сбор аренды"
                value={
                  property.rentCollectionMode === "OWNER_DIRECT"
                    ? "Собственник напрямую"
                    : "Оператор"
                }
              />
              {property.managementType === "COMMISSION" ? (
                <>
                  <Fact
                    label="Комиссия посуточно"
                    value={formatPercent(property.commissionDaily)}
                  />
                  <Fact
                    label="Комиссия помесячно"
                    value={formatPercent(property.commissionMonthly)}
                  />
                </>
              ) : null}
            </dl>
          </SectionCard>
          <SectionCard title="Цены">
            <dl className="grid grid-cols-2 gap-3">
              <Fact
                label="Посуточно"
                value={formatMoney(property.dailyPrice)}
              />
              <Fact
                label="Помесячно (ориентир)"
                value={formatMoney(property.monthlyPrice)}
              />
            </dl>
          </SectionCard>
          <SectionCard title="Вместимость">
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Гостей" value={property.guests} />
              <Fact label="Комнаты" value={property.rooms} />
              <Fact label="Спальни" value={property.bedrooms} />
              <Fact label="Ванные" value={property.bathrooms} />
            </dl>
          </SectionCard>
          <SectionCard title="Описание">
            {property.shortDescription ? (
              <p className="text-sm font-medium text-[var(--finance-text)]">
                {property.shortDescription}
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--finance-text-secondary)]">
              {property.description || "—"}
            </p>
          </SectionCard>
          <SectionCard title="Собственник">
            {owner ? (
              <dl className="grid grid-cols-2 gap-3">
                <Fact
                  label="Owner"
                  value={
                    <Link
                      href={`/crm/finance/owners/${owner.id}`}
                      className="font-medium text-[var(--finance-blue)] hover:underline"
                    >
                      {owner.name}
                    </Link>
                  }
                />
                <Fact label="Телефон" value={owner.phone || "Не указан"} />
              </dl>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <Fact
                  label="Имя (legacy)"
                  value={property.ownerName || "Не указан"}
                />
                <Fact
                  label="Телефон (legacy)"
                  value={property.ownerPhone || "Не указан"}
                />
              </dl>
            )}
            {owner && (property.ownerName || property.ownerPhone) ? (
              <p className="mt-3 text-xs text-[var(--finance-text-muted)]">
                Legacy: {property.ownerName || "—"} ·{" "}
                {property.ownerPhone || "—"}
              </p>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {tab === "photos" ? (
        <PropertyPhotoGallery
          propertyId={property.id}
          initialPhotos={photos}
        />
      ) : null}

      {tab === "short-term" ? (
        <div className="space-y-4">
          <SectionCard
            title="Посуточная аренда"
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/crm/bookings/new?propertyId=${property.id}`}
                  className="rounded-lg bg-[var(--finance-blue)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  + Создать бронь
                </Link>
                <Link
                  href={calendarHref}
                  className="rounded-lg border border-[var(--finance-border)] px-3 py-1.5 text-xs font-medium"
                >
                  Открыть календарь
                </Link>
              </div>
            }
          >
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact
                label="Цена / сутки"
                value={formatMoney(property.dailyPrice)}
              />
              <Fact label="Вместимость" value={`${property.guests} гост.`} />
              <Fact
                label="Комиссия"
                value={
                  property.managementType === "COMMISSION"
                    ? formatPercent(property.commissionDaily)
                    : "—"
                }
              />
            </dl>
          </SectionCard>
          <SectionCard title="Ближайшие бронирования">
            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-[var(--finance-text-secondary)]">
                Нет ближайших бронирований
              </p>
            ) : (
              <ul className="divide-y divide-[var(--finance-border)]">
                {upcomingBookings.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-[var(--finance-text)]">
                        {booking.guestName}
                      </p>
                      <p className="text-xs text-[var(--finance-text-muted)]">
                        {formatDate(booking.checkIn)} —{" "}
                        {formatDate(booking.checkOut)}
                      </p>
                    </div>
                    <Link
                      href={`/crm/bookings/${booking.id}`}
                      className="text-sm text-[var(--finance-blue)] hover:underline"
                    >
                      Открыть
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Каналы посуточной аренды">
            <p className="mb-3 text-sm text-[var(--finance-text-secondary)]">
              Привязки ChannelListing — в разделе «Интеграции».
            </p>
            <button
              type="button"
              onClick={() => setTab("integrations")}
              className="text-sm font-medium text-[var(--finance-blue)] hover:underline"
            >
              Открыть интеграции
            </button>
          </SectionCard>
        </div>
      ) : null}

      {tab === "long-term" ? (
        longTerm ? (
          <SectionCard
            title="Долгосрочная аренда"
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/crm/long-term/${longTerm.id}`}
                  className="rounded-lg bg-[var(--finance-blue)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Открыть карточку
                </Link>
                <Link
                  href={`/crm/long-term/${longTerm.id}/edit`}
                  className="rounded-lg border border-[var(--finance-border)] px-3 py-1.5 text-xs font-medium"
                >
                  Редактировать
                </Link>
                <Link
                  href={`/crm/long-term/${longTerm.id}`}
                  className="rounded-lg border border-[var(--finance-border)] px-3 py-1.5 text-xs font-medium"
                >
                  Публикации
                </Link>
              </div>
            }
          >
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact
                label="Статус"
                value={longTermStatusLabels[longTerm.status]}
              />
              <Fact
                label="Месячная цена"
                value={formatMoney(longTerm.monthlyPrice)}
              />
              <Fact label="Депозит" value={formatMoney(longTerm.deposit)} />
              <Fact
                label="Комиссия"
                value={formatPercent(longTerm.commission)}
              />
              <Fact
                label="Мин. срок"
                value={`${longTerm.minimumRentalPeriod} мес.`}
              />
              <Fact
                label="Спецпредложение"
                value={
                  longTerm.specialOfferPrice != null
                    ? formatMoney(longTerm.specialOfferPrice)
                    : longTerm.specialOfferText || "—"
                }
              />
              <Fact
                label="Публикации"
                value={longTerm.publicationSummary}
              />
            </dl>
          </SectionCard>
        ) : (
          <SectionCard title="Долгосрочная аренда">
            <p className="text-sm text-[var(--finance-text-secondary)]">
              Долгосрочная аренда не настроена
            </p>
            <Link
              href={`/crm/long-term/new?propertyId=${property.id}`}
              className="mt-4 inline-flex rounded-xl bg-[var(--finance-blue)] px-4 py-2 text-sm font-medium text-white"
            >
              Настроить
            </Link>
          </SectionCard>
        )
      ) : null}

      {tab === "sales" ? (
        sale ? (
          <SectionCard
            title="Продажа"
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/crm/sales/properties/${sale.id}`}
                  className="rounded-lg bg-[var(--finance-blue)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Открыть продажу
                </Link>
                <Link
                  href={`/crm/sales/properties/${sale.id}/edit`}
                  className="rounded-lg border border-[var(--finance-border)] px-3 py-1.5 text-xs font-medium"
                >
                  Редактировать
                </Link>
              </div>
            }
          >
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact
                label="Статус"
                value={saleListingStatusLabels[sale.status]}
              />
              <Fact label="Цена" value={formatMoney(sale.price)} />
              <Fact
                label="Маркетинговое название"
                value={sale.marketingTitle || "—"}
              />
              <Fact label="Интересы" value={sale.interestsCount} />
              <Fact label="Просмотры" value={sale.viewingsCount} />
              <Fact
                label="Депозиты"
                value={
                  sale.depositsCount > 0
                    ? `${sale.depositsCount} (ожидают: ${sale.depositPendingCount})`
                    : "—"
                }
              />
            </dl>
          </SectionCard>
        ) : (
          <SectionCard title="Продажа">
            <p className="text-sm text-[var(--finance-text-secondary)]">
              Объект не выставлен на продажу
            </p>
            <Link
              href={`/crm/sales/properties/new?propertyId=${property.id}`}
              className="mt-4 inline-flex rounded-xl bg-[var(--finance-blue)] px-4 py-2 text-sm font-medium text-white"
            >
              Добавить в продажи
            </Link>
          </SectionCard>
        )
      ) : null}

      {tab === "finance" ? (
        <SectionCard
          title="Финансы объекта"
          action={
            <Link
              href={`/crm/finance/properties/${property.id}`}
              className="rounded-lg bg-[var(--finance-blue)] px-3 py-1.5 text-xs font-medium text-white"
            >
              Открыть финансы объекта
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-[var(--finance-hover)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Оборот
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(finance.grossRent)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--finance-hover)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Моя выручка
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(finance.businessRevenue)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--finance-hover)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Расходы
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(finance.totalExpenses)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--finance-hover)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Чистая прибыль
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(finance.netProfit)}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {tab === "integrations" ? (
        <PropertyChannels propertyId={property.id} />
      ) : null}

      {(tab === "overview" || tab === "photos") && <DangerZone property={property} />}
    </div>
  );
}
