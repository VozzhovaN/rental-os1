"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconBuilding, IconSettings } from "@/components/crm/icons";
import {
  SalePhotoLightbox,
  type GalleryPhoto,
} from "@/components/sales/sale-photo-lightbox";
import { formatDateTime } from "@/lib/format";
import { longTermStatusLabels } from "@/lib/long-term-labels";
import type { LongTermListingDTO } from "@/lib/long-term-listings";
import { formatMoney, propertyTypeLabels } from "@/lib/property-labels";
import { parseUpdateLongTermListing } from "@/lib/validations/long-term-listing";

const statusStyles = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  PAUSED: "bg-amber-50 text-amber-800",
  ARCHIVED: "bg-zinc-100 text-zinc-500",
} as const;

const STORAGE_KEY = "rental-os:long-term-listings-columns-v1";

type ColumnId =
  | "photo"
  | "object"
  | "price"
  | "specialPrice"
  | "status"
  | "city"
  | "rooms"
  | "area"
  | "description"
  | "contact"
  | "ads"
  | "updatedAt"
  | "actions";

type ColumnDef = {
  id: ColumnId;
  label: string;
  locked?: boolean;
  defaultVisible: boolean;
};

const COLUMNS: ColumnDef[] = [
  { id: "photo", label: "Фото", locked: true, defaultVisible: true },
  { id: "object", label: "Объект", locked: true, defaultVisible: true },
  { id: "price", label: "Цена в месяц", defaultVisible: true },
  { id: "specialPrice", label: "Спец. цена", defaultVisible: true },
  { id: "status", label: "Статус", defaultVisible: true },
  { id: "city", label: "Город", defaultVisible: false },
  { id: "rooms", label: "Комнаты", defaultVisible: false },
  { id: "area", label: "Площадь", defaultVisible: false },
  { id: "description", label: "Описание", defaultVisible: false },
  { id: "contact", label: "Контакт публикации", defaultVisible: false },
  { id: "ads", label: "Реклама", defaultVisible: true },
  { id: "updatedAt", label: "Обновлено", defaultVisible: true },
  { id: "actions", label: "Действия", locked: true, defaultVisible: true },
];

function defaultVisibility(): Record<ColumnId, boolean> {
  return Object.fromEntries(
    COLUMNS.map((col) => [col.id, col.defaultVisible]),
  ) as Record<ColumnId, boolean>;
}

function loadVisibility(): Record<ColumnId, boolean> {
  const base = defaultVisibility();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    for (const col of COLUMNS) {
      if (col.locked) {
        base[col.id] = true;
      } else if (typeof parsed[col.id] === "boolean") {
        base[col.id] = parsed[col.id]!;
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

function firstPhotoUrl(listing: LongTermListingDTO, gallery: GalleryPhoto[]) {
  const included = listing.photos.filter((photo) => photo.included);
  return included[0]?.url ?? gallery[0]?.url ?? listing.photos[0]?.url ?? null;
}

function truncate(text: string | null | undefined, max = 80) {
  if (!text?.trim()) return null;
  const value = text.trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export type LongTermAdsSummary = {
  label: string;
  published: boolean;
};

type LongTermListProps = {
  listings: LongTermListingDTO[];
  propertyPhotosById: Record<string, GalleryPhoto[]>;
  adsByListingId: Record<string, LongTermAdsSummary>;
};

export function LongTermList({
  listings,
  propertyPhotosById,
  adsByListingId,
}: LongTermListProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [visibility, setVisibility] = useState<Record<ColumnId, boolean>>(loadVisibility);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    title: string;
    photos: GalleryPhoto[];
  } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [visibility]);

  const cities = useMemo(() => {
    const set = new Set(listings.map((item) => item.property.city).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [listings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = priceMin.trim() ? Number(priceMin) : null;
    const max = priceMax.trim() ? Number(priceMax) : null;

    return listings.filter((listing) => {
      if (status && listing.status !== status) return false;
      if (city && listing.property.city !== city) return false;
      if (min != null && Number.isFinite(min) && listing.monthlyPrice < min) return false;
      if (max != null && Number.isFinite(max) && listing.monthlyPrice > max) return false;
      if (!needle) return true;

      const title = listing.marketingTitle?.toLowerCase() ?? "";
      const description = listing.description?.toLowerCase() ?? "";
      const propertyDescription = listing.property.description?.toLowerCase() ?? "";
      const contact = `${listing.publicationContactName ?? ""} ${listing.publicationPhoneNumber ?? ""}`.toLowerCase();

      return (
        listing.property.name.toLowerCase().includes(needle) ||
        title.includes(needle) ||
        listing.property.city.toLowerCase().includes(needle) ||
        listing.property.address.toLowerCase().includes(needle) ||
        listing.property.district.toLowerCase().includes(needle) ||
        description.includes(needle) ||
        propertyDescription.includes(needle) ||
        contact.includes(needle)
      );
    });
  }, [listings, q, status, city, priceMin, priceMax]);

  const visibleColumns = COLUMNS.filter((col) => visibility[col.id]);

  function toggleColumn(id: ColumnId) {
    const def = COLUMNS.find((col) => col.id === id);
    if (!def || def.locked) return;
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openGallery(listing: LongTermListingDTO) {
    const gallery = propertyPhotosById[listing.propertyId] ?? [];
    const photos =
      gallery.length > 0
        ? gallery
        : listing.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            caption: photo.caption,
          }));
    setLightbox({
      title: listing.marketingTitle || listing.property.name,
      photos,
    });
  }

  async function patchStatus(id: string, nextStatus: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    setError(null);
    setPendingId(id);
    try {
      const parsed = parseUpdateLongTermListing({ status: nextStatus });
      if (!parsed.success) {
        throw new Error("Некорректные данные");
      }
      const response = await fetch(`/api/long-term-listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось изменить статус");
      }
      router.refresh();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Не удалось изменить статус");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Поиск
            </span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Название, адрес, описание, контакт…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Статус
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Все статусы</option>
              <option value="DRAFT">Черновик</option>
              <option value="ACTIVE">Активно</option>
              <option value="PAUSED">На паузе</option>
              <option value="ARCHIVED">Архив</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Город
            </span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="min-w-[8rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Все города</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Цена от
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={priceMin}
              onChange={(event) => setPriceMin(event.target.value)}
              placeholder="0"
              className="w-[7.5rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Цена до
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value)}
              placeholder="∞"
              className="w-[7.5rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="relative ml-auto flex items-center gap-2">
            {(q || status || city || priceMin || priceMax) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setStatus("");
                  setCity("");
                  setPriceMin("");
                  setPriceMax("");
                }}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Сбросить
              </button>
            )}
            <button
              type="button"
              onClick={() => setColumnsOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              aria-expanded={columnsOpen}
            >
              <IconSettings size={16} />
              Столбцы
            </button>
            {columnsOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label="Закрыть настройки столбцов"
                  onClick={() => setColumnsOpen(false)}
                />
                <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">Отображение столбцов</p>
                    <button
                      type="button"
                      onClick={() => setVisibility(defaultVisibility())}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                    >
                      По умолчанию
                    </button>
                  </div>
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {COLUMNS.map((col) => (
                      <li key={col.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 ${
                            col.locked ? "opacity-70" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={visibility[col.id]}
                            disabled={col.locked}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-zinc-300"
                          />
                          <span>{col.label}</span>
                          {col.locked ? (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">
                              всегда
                            </span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Показано {filtered.length} из {listings.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-zinc-600">
          {listings.length === 0
            ? "Объявлений долгосрочной аренды пока нет. Добавьте первое объявление."
            : "По выбранным фильтрам ничего не найдено."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`px-3 py-2.5 font-medium ${
                      col.id === "photo" ? "w-[1%] whitespace-nowrap" : ""
                    }`}
                  >
                    {col.id === "actions" ? <span className="sr-only">{col.label}</span> : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing) => {
                const gallery = propertyPhotosById[listing.propertyId] ?? [];
                const cover = firstPhotoUrl(listing, gallery);
                const title = listing.marketingTitle || listing.property.name;
                const description = truncate(
                  listing.description || listing.property.description,
                  100,
                );
                const contact = [
                  listing.publicationContactName,
                  listing.publicationPhoneCountryCode && listing.publicationPhoneNumber
                    ? `+${listing.publicationPhoneCountryCode} ${listing.publicationPhoneNumber}`
                    : listing.publicationPhoneNumber,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const ads = adsByListingId[listing.id] ?? {
                  label: "Не опубликовано",
                  published: false,
                };

                return (
                  <tr
                    key={listing.id}
                    className="border-t border-zinc-100 align-middle hover:bg-zinc-50/60"
                  >
                    {visibleColumns.map((col) => {
                      switch (col.id) {
                        case "photo":
                          return (
                            <td key={col.id} className="w-[10.5rem] min-w-[10.5rem] px-3 py-3">
                              <button
                                type="button"
                                onClick={() => openGallery(listing)}
                                className="block h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 text-left sm:h-28 sm:w-40"
                                title="Открыть фото объекта"
                              >
                                {cover ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={cover}
                                    alt=""
                                    className="h-full w-full max-w-none object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-zinc-400">
                                    <IconBuilding size={28} />
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        case "object":
                          return (
                            <td key={col.id} className="min-w-[12rem] px-3 py-3">
                              <Link
                                href={`/crm/long-term/${listing.id}`}
                                className="font-medium text-zinc-900 hover:underline"
                              >
                                {title}
                              </Link>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {listing.property.address}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-400">
                                {propertyTypeLabels[listing.property.type]} · {listing.property.city}
                              </p>
                              {listing.marketingTitle ? (
                                <p className="mt-0.5 text-xs text-zinc-400">
                                  {listing.property.name}
                                </p>
                              ) : null}
                            </td>
                          );
                        case "price":
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-3 font-medium tabular-nums"
                            >
                              {formatMoney(listing.monthlyPrice)}
                            </td>
                          );
                        case "specialPrice":
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-3 text-zinc-600 tabular-nums"
                            >
                              {listing.specialOfferPrice != null
                                ? formatMoney(listing.specialOfferPrice)
                                : "—"}
                            </td>
                          );
                        case "status":
                          return (
                            <td key={col.id} className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[listing.status]}`}
                              >
                                {longTermStatusLabels[listing.status]}
                              </span>
                            </td>
                          );
                        case "city":
                          return (
                            <td key={col.id} className="px-3 py-3 text-zinc-600">
                              {listing.property.city}
                              {listing.property.district ? (
                                <span className="block text-xs text-zinc-400">
                                  {listing.property.district}
                                </span>
                              ) : null}
                            </td>
                          );
                        case "rooms":
                          return (
                            <td key={col.id} className="px-3 py-3 tabular-nums text-zinc-600">
                              {listing.property.rooms}
                            </td>
                          );
                        case "area":
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-600"
                            >
                              {listing.property.area} м²
                            </td>
                          );
                        case "description":
                          return (
                            <td
                              key={col.id}
                              className="max-w-[18rem] px-3 py-3 text-xs leading-snug text-zinc-600"
                            >
                              {description ?? <span className="text-zinc-400">—</span>}
                            </td>
                          );
                        case "contact":
                          return (
                            <td key={col.id} className="px-3 py-3 text-xs text-zinc-600">
                              {contact || "—"}
                            </td>
                          );
                        case "ads":
                          return (
                            <td
                              key={col.id}
                              className={`px-3 py-3 text-xs ${
                                ads.published ? "text-emerald-700" : "text-zinc-500"
                              }`}
                            >
                              {ads.label}
                            </td>
                          );
                        case "updatedAt":
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-3 text-zinc-500"
                            >
                              {formatDateTime(listing.updatedAt)}
                            </td>
                          );
                        case "actions":
                          return (
                            <td key={col.id} className="relative z-10 px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/crm/long-term/${listing.id}`}
                                  className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-white"
                                >
                                  Открыть
                                </Link>
                                <Link
                                  href={`/crm/long-term/${listing.id}/edit`}
                                  prefetch={false}
                                  className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-white"
                                >
                                  Редактировать
                                </Link>
                                {listing.status !== "PAUSED" && listing.status !== "ARCHIVED" ? (
                                  <button
                                    type="button"
                                    disabled={pendingId === listing.id}
                                    onClick={() => void patchStatus(listing.id, "PAUSED")}
                                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50 hover:bg-white"
                                  >
                                    На паузу
                                  </button>
                                ) : null}
                                {listing.status !== "ACTIVE" && listing.status !== "ARCHIVED" ? (
                                  <button
                                    type="button"
                                    disabled={pendingId === listing.id}
                                    onClick={() => void patchStatus(listing.id, "ACTIVE")}
                                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50 hover:bg-white"
                                  >
                                    Активировать
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SalePhotoLightbox
        open={lightbox != null}
        title={lightbox?.title ?? ""}
        photos={lightbox?.photos ?? []}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
