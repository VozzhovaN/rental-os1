"use client";

import { useMemo, useState } from "react";
import type { LongTermListingDTO } from "@/lib/long-term-listings";

type PoolPhoto = {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
};

export function LongTermPhotos({
  listing,
  pool,
}: {
  listing: LongTermListingDTO;
  pool: PoolPhoto[];
}) {
  const [photos, setPhotos] = useState(pool);
  const [selected, setSelected] = useState<Record<string, { included: boolean; sortOrder: number }>>(
    () => {
      const initial: Record<string, { included: boolean; sortOrder: number }> = {};
      for (const item of listing.photos) {
        initial[item.photoId] = { included: item.included, sortOrder: item.sortOrder };
      }
      return initial;
    },
  );
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const orderedIds = useMemo(
    () =>
      Object.entries(selected)
        .sort((left, right) => left[1].sortOrder - right[1].sortOrder)
        .map(([id]) => id),
    [selected],
  );

  async function addPhoto() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${listing.propertyId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { error?: string; photo?: PoolPhoto };
      if (!response.ok || !payload.photo) {
        throw new Error(payload.error || "Не удалось добавить фото");
      }
      setPhotos((current) => [...current, payload.photo as PoolPhoto]);
      setSelected((current) => ({
        ...current,
        [payload.photo!.id]: { included: true, sortOrder: Object.keys(current).length },
      }));
      setUrl("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Не удалось добавить фото");
    } finally {
      setPending(false);
    }
  }

  async function save() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const items = photos.map((photo, index) => ({
        photoId: photo.id,
        sortOrder: selected[photo.id]?.sortOrder ?? index,
        included: selected[photo.id]?.included ?? false,
      }));
      const response = await fetch(`/api/long-term-listings/${listing.id}/photos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить фото");
      }
      setNotice("Подбор фотографий сохранён");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить фото");
    } finally {
      setPending(false);
    }
  }

  function move(photoId: string, delta: number) {
    setSelected((current) => {
      const ids = photos.map((photo) => photo.id);
      const from = ids.indexOf(photoId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) {
        return current;
      }
      const nextIds = [...ids];
      const [moved] = nextIds.splice(from, 1);
      nextIds.splice(to, 0, moved);
      const next = { ...current };
      nextIds.forEach((id, index) => {
        next[id] = { included: current[id]?.included ?? false, sortOrder: index };
      });
      return next;
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Фото для долгосрочной рекламы</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Файлы принадлежат объекту. Здесь выбирается, какие из них показывать в карточке.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://..."
          className="min-w-64 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !url.trim()}
          onClick={() => void addPhoto()}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Добавить в пул объекта
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-zinc-500">У объекта пока нет фотографий.</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((photo) => {
            const state = selected[photo.id] ?? { included: false, sortOrder: 0 };
            return (
              <li
                key={photo.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-16 w-24 max-w-none shrink-0 rounded object-cover bg-zinc-100" />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.included}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [photo.id]: {
                          included: event.target.checked,
                          sortOrder: current[photo.id]?.sortOrder ?? orderedIds.length,
                        },
                      }))
                    }
                  />
                  Показывать в объявлении
                </label>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(photo.id, -1)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                  >
                    Выше
                  </button>
                  <button
                    type="button"
                    onClick={() => move(photo.id, 1)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                  >
                    Ниже
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Сохранить подбор фото
      </button>
    </section>
  );
}
