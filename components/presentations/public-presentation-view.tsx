"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicPresentationDTO } from "@/lib/presentation-public";

function AdvantageList({ content }: { content: string }) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLike = lines.length > 1 || lines.some((l) => /^[•\-✓*]/.test(l));
  if (!bulletLike) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#334155]">
        {content}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line} className="flex gap-2 text-[15px] text-[#334155]">
          <span className="text-[var(--finance-green)]" aria-hidden>
            ✓
          </span>
          <span>{line.replace(/^[•\-✓*]\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemGallery({
  photos,
  title,
}: {
  photos: Array<{ id: string; url: string; alt: string }>;
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = photos[index] ?? null;

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return;
      setIndex((i) => (i + delta + photos.length) % photos.length);
    },
    [photos.length],
  );

  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, go]);

  if (!current) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-[#EEF3F9] text-[#94A3B8]">
        Нет фото
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-[#EEF3F9]">
        <button
          type="button"
          className="block w-full"
          onClick={() => setLightbox(true)}
          aria-label="Открыть галерею"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={title}
            className="aspect-video w-full object-cover"
          />
        </button>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm shadow"
              onClick={() => go(-1)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm shadow"
              onClick={() => go(1)}
            >
              →
            </button>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === index
                  ? "border-[var(--finance-blue)]"
                  : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal
          aria-label="Галерея"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-white"
            onClick={() => setLightbox(false)}
            aria-label="Закрыть"
          >
            ✕
          </button>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white"
            onClick={() => go(-1)}
            aria-label="Предыдущее"
          >
            ←
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={title}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white"
            onClick={() => go(1)}
            aria-label="Следующее"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PublicPresentationView({
  presentation,
}: {
  presentation: PublicPresentationDTO;
}) {
  return (
    <div className="min-h-screen bg-[#F7FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-30 border-b border-[#E7ECF3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
              {presentation.companyName || "Rental OS"}
            </p>
            <p className="text-sm font-medium">Персональное предложение</p>
          </div>
          <a
            href={`/api/p/${presentation.token}/pdf`}
            className="rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white"
          >
            Скачать PDF
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 pb-20">
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--finance-blue)]">
            Персональное предложение
          </p>
          {presentation.subtitle ? (
            <p className="text-sm text-[#64748B]">{presentation.subtitle}</p>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {presentation.title}
          </h1>
        </section>

        {presentation.items.length > 1 ? (
          <nav
            className="flex gap-2 overflow-x-auto pb-1"
            aria-label="Варианты"
          >
            {presentation.items.map((item, index) => (
              <a
                key={item.id}
                href={`#item-${item.id}`}
                className="shrink-0 rounded-full border border-[#E7ECF3] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] hover:border-[var(--finance-blue)]"
              >
                Вариант {index + 1}
              </a>
            ))}
            <a
              href="#compare"
              className="shrink-0 rounded-full border border-[#E7ECF3] bg-white px-3 py-1.5 text-sm font-medium"
            >
              Сравнение
            </a>
          </nav>
        ) : null}

        {presentation.items.map((item, index) => (
          <article
            key={item.id}
            id={`item-${item.id}`}
            className="space-y-6 rounded-[20px] border border-[#E7ECF3] bg-white p-4 shadow-[0_3px_12px_rgba(25,45,80,0.035)] sm:p-6"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {presentation.items.length > 1 ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                    Вариант {index + 1}
                  </p>
                ) : null}
                <h2 className="text-2xl font-semibold tracking-tight">
                  {item.title}
                </h2>
              </div>
              {item.priceLabel ? (
                <p className="text-2xl font-semibold text-[var(--finance-blue)]">
                  {item.priceLabel}
                </p>
              ) : null}
            </div>

            <ItemGallery photos={item.photos} title={item.title} />

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {[
                item.areaLabel ? { label: "Площадь", value: item.areaLabel } : null,
                item.rooms != null
                  ? { label: "Комнаты", value: String(item.rooms) }
                  : null,
                item.bedrooms != null
                  ? { label: "Спальни", value: String(item.bedrooms) }
                  : null,
                item.guests != null
                  ? { label: "Гостей", value: `до ${item.guests}` }
                  : null,
                item.floor != null
                  ? {
                      label: "Этаж",
                      value:
                        item.totalFloors != null
                          ? `${item.floor} / ${item.totalFloors}`
                          : String(item.floor),
                    }
                  : null,
              ]
                .filter(Boolean)
                .map((fact) => (
                  <div
                    key={fact!.label}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-2"
                  >
                    <dt className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
                      {fact!.label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold">{fact!.value}</dd>
                  </div>
                ))}
            </dl>

            {item.description ? (
              <section>
                <h3 className="mb-2 text-lg font-semibold">Об объекте</h3>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#334155]">
                  {item.description}
                </p>
              </section>
            ) : null}

            {item.videoUrl ? (
              <section>
                <h3 className="mb-2 text-lg font-semibold">Видео объекта</h3>
                <a
                  href={item.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[var(--finance-blue)] hover:underline"
                >
                  Открыть видео
                </a>
              </section>
            ) : null}

            {item.sections
              .filter((s) => s.type !== "DESCRIPTION" || !item.description)
              .map((section) =>
                section.content.trim() ? (
                  <section key={section.id}>
                    <h3 className="mb-2 text-lg font-semibold">
                      {section.title}
                    </h3>
                    {section.type === "ADVANTAGES" ? (
                      <AdvantageList content={section.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#334155]">
                        {section.content}
                      </p>
                    )}
                  </section>
                ) : null,
              )}

            <section>
              <h3 className="mb-2 text-lg font-semibold">Расположение</h3>
              <p className="text-[15px] text-[#334155]">
                {[item.city, item.district, item.address]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-2 text-xs text-[#94A3B8]">
                Карта недоступна: координаты объекта не заданы
                (PROPERTY_COORDINATES_GAP).
              </p>
              <a
                href={`https://yandex.ru/maps/?text=${encodeURIComponent(
                  [item.city, item.address].filter(Boolean).join(", "),
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-[var(--finance-blue)] hover:underline"
              >
                Открыть на карте
              </a>
            </section>
          </article>
        ))}

        {presentation.items.length > 1 ? (
          <section
            id="compare"
            className="overflow-x-auto rounded-[20px] border border-[#E7ECF3] bg-white p-4 sm:p-6"
          >
            <h2 className="mb-4 text-xl font-semibold">Сравнение вариантов</h2>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E7ECF3] text-[#94A3B8]">
                  <th className="py-2 pr-3 font-medium" />
                  {presentation.items.map((_, i) => (
                    <th key={i} className="py-2 pr-3 font-medium">
                      №{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Цена", (i) => i.priceLabel || "—"],
                    ["Площадь", (i) => i.areaLabel || "—"],
                    ["Комнаты", (i) => (i.rooms != null ? String(i.rooms) : "—")],
                    [
                      "Спальни",
                      (i) => (i.bedrooms != null ? String(i.bedrooms) : "—"),
                    ],
                    ["Гостей", (i) => (i.guests != null ? String(i.guests) : "—")],
                    ["Локация", (i) => i.city || "—"],
                  ] as Array<
                    [string, (item: PublicPresentationDTO["items"][number]) => string]
                  >
                ).map(([label, getter]) => (
                  <tr key={label} className="border-b border-[#E7ECF3]">
                    <td className="py-2.5 pr-3 font-medium text-[#64748B]">
                      {label}
                    </td>
                    {presentation.items.map((item) => (
                      <td key={item.id} className="py-2.5 pr-3">
                        {getter(item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="rounded-[20px] border border-[#E7ECF3] bg-white p-6 text-center">
          <h2 className="text-xl font-semibold">Понравился этот вариант?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[#64748B]">
            Свяжитесь с нами — поможем уточнить свободные даты и оформить
            бронирование.
          </p>
          <div className="mt-4 space-y-1 text-sm">
            {presentation.contactName ? (
              <p className="font-medium">{presentation.contactName}</p>
            ) : null}
            {presentation.contactPhone ? (
              <p>
                <a
                  href={`tel:${presentation.contactPhone.replace(/\s/g, "")}`}
                  className="text-[var(--finance-blue)] hover:underline"
                >
                  {presentation.contactPhone}
                </a>
              </p>
            ) : null}
            {presentation.contactEmail ? (
              <p>
                <a
                  href={`mailto:${presentation.contactEmail}`}
                  className="text-[var(--finance-blue)] hover:underline"
                >
                  {presentation.contactEmail}
                </a>
              </p>
            ) : null}
          </div>
          <a
            href={`/api/p/${presentation.token}/pdf`}
            className="mt-6 inline-flex rounded-xl border border-[#E7ECF3] px-4 py-2.5 text-sm font-medium"
          >
            ↓ Скачать PDF
          </a>
        </section>
      </main>
    </div>
  );
}
