"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type PropertyObjectPhoto = {
  id: string;
  url: string;
  isCover?: boolean;
  sortOrder?: number;
};

export type PropertyObjectSummary = {
  id: string;
  name: string;
  typeLabel: string;
  areaLabel: string;
  city: string;
  address: string;
  /** Extra line under address (e.g. booking capacity). */
  metaLine?: string | null;
};

export function PropertyObjectBlock({
  property,
  photos,
  propertyHref,
  linkLabel = "Открыть исходный Property",
}: {
  property: PropertyObjectSummary;
  photos: PropertyObjectPhoto[];
  propertyHref: string;
  linkLabel?: string;
}) {
  const ordered = useMemo(() => {
    const copy = [...photos];
    copy.sort((left, right) => {
      const coverDelta = Number(Boolean(right.isCover)) - Number(Boolean(left.isCover));
      if (coverDelta !== 0) return coverDelta;
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    });
    return copy;
  }, [photos]);

  const [index, setIndex] = useState(0);
  const safeIndex = ordered.length === 0 ? 0 : Math.min(index, ordered.length - 1);
  const current = ordered[safeIndex] ?? null;

  function go(delta: number) {
    if (ordered.length <= 1) return;
    setIndex((currentIndex) => {
      const next = (currentIndex + delta + ordered.length) % ordered.length;
      return next;
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Объект</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-zinc-900">{property.name}</p>
          <p className="text-sm text-zinc-600">
            {property.typeLabel}, {property.areaLabel}, {property.city}
          </p>
          <p className="text-sm text-zinc-600">{property.address}</p>
          {property.metaLine ? <p className="text-sm text-zinc-500">{property.metaLine}</p> : null}
          <Link href={propertyHref} className="inline-block pt-1 text-sm underline">
            {linkLabel}
          </Link>
        </div>

        <div className="w-full shrink-0 sm:w-56 md:w-64">
          {current ? (
            <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              {current.isCover || safeIndex === 0 ? (
                <span className="absolute left-2 top-2 rounded bg-zinc-900/85 px-2 py-0.5 text-[10px] font-medium text-white">
                  ★ Обложка
                </span>
              ) : null}
              {ordered.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Предыдущее фото"
                    className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-medium text-zinc-800 shadow hover:bg-white"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Следующее фото"
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-medium text-zinc-800 shadow hover:bg-white"
                  >
                    ›
                  </button>
                  <span className="absolute bottom-2 right-2 rounded bg-zinc-900/75 px-1.5 py-0.5 text-[10px] text-white">
                    {safeIndex + 1} / {ordered.length}
                  </span>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
              Нет фото
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
