"use client";

import { useEffect, useMemo, useState } from "react";
import { IconX } from "@/components/crm/icons";
import { isFloorPlanCaption } from "@/lib/sale-photo-labels";

export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string | null;
  isFloorPlan?: boolean;
};

type SalePhotoLightboxProps = {
  open: boolean;
  title: string;
  photos: GalleryPhoto[];
  initialIndex?: number;
  onClose: () => void;
};

export function SalePhotoLightbox({
  open,
  title,
  photos,
  initialIndex = 0,
  onClose,
}: SalePhotoLightboxProps) {
  const ordered = useMemo(() => {
    const withFlags = photos.map((photo) => ({
      ...photo,
      isFloorPlan: photo.isFloorPlan ?? isFloorPlanCaption(photo.caption),
    }));
    return [...withFlags].sort((a, b) => Number(b.isFloorPlan) - Number(a.isFloorPlan));
  }, [photos]);

  const [index, setIndex] = useState(initialIndex);
  const syncKey = `${open}:${initialIndex}:${ordered.length}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (open) {
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(ordered.length - 1, 0)));
    }
  }

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((current) => (ordered.length ? (current + 1) % ordered.length : 0));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) =>
          ordered.length ? (current - 1 + ordered.length) % ordered.length : 0,
        );
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ordered.length]);

  if (!open) return null;

  const current = ordered[index] ?? null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-zinc-950/92 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Фото: ${title}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-zinc-300">
            {ordered.length === 0
              ? "Нет фотографий"
              : `${index + 1} / ${ordered.length}${
                  current?.isFloorPlan ? " · Планировка" : ""
                }`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Закрыть"
        >
          <IconX size={18} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.caption ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-zinc-300">Для объекта пока нет фотографий</p>
        )}

        {ordered.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:inline-flex"
              onClick={() =>
                setIndex((current) => (current - 1 + ordered.length) % ordered.length)
              }
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:inline-flex"
              onClick={() => setIndex((current) => (current + 1) % ordered.length)}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {ordered.length > 0 ? (
        <div className="border-t border-white/10 px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ordered.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(photoIndex)}
                className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-md border ${
                  photoIndex === index ? "border-white" : "border-transparent opacity-70"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                {photo.isFloorPlan ? (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] leading-none">
                    План
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
