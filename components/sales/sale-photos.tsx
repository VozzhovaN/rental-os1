"use client";

import { useMemo, useRef, useState } from "react";
import { uploadPropertyPhotos } from "@/lib/property-photo-client";
import type { SaleListingDTO } from "@/lib/sale-listings";

type PoolPhoto = {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
};

export function SalePhotos({
  listing,
  pool,
}: {
  listing: SaleListingDTO;
  pool: PoolPhoto[];
}) {
  const [photos, setPhotos] = useState(pool);
  const [selected, setSelected] = useState<Record<string, { selected: boolean; order: number }>>(
    () => {
      const initial: Record<string, { selected: boolean; order: number }> = {};
      for (const item of listing.photos) {
        initial[item.photoId] = { selected: true, order: item.order };
      }
      return initial;
    },
  );
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderedSelectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, state]) => state.selected)
        .sort((left, right) => left[1].order - right[1].order)
        .map(([id]) => id),
    [selected],
  );

  const coverId = orderedSelectedIds[0] ?? null;

  function appendPhotos(newPhotos: PoolPhoto[]) {
    if (newPhotos.length === 0) {
      return;
    }
    setPhotos((current) => [...current, ...newPhotos]);
    setSelected((current) => {
      const next = { ...current };
      let order = Object.values(current).filter((item) => item.selected).length;
      for (const photo of newPhotos) {
        next[photo.id] = { selected: true, order };
        order += 1;
      }
      return next;
    });
  }

  async function addPhotoByUrl() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${listing.propertyId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const text = await response.text();
      const payload = text
        ? (JSON.parse(text) as { error?: string; photo?: PoolPhoto })
        : { error: "Не удалось добавить фото" };
      if (!response.ok || !payload.photo) {
        throw new Error(payload.error || "Не удалось добавить фото");
      }
      appendPhotos([payload.photo]);
      setUrl("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Не удалось добавить фото");
    } finally {
      setPending(false);
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setError(null);
    setPending(true);
    try {
      const uploaded = await uploadPropertyPhotos(listing.propertyId, Array.from(fileList));
      appendPhotos(
        uploaded.map((photo) => ({
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          sortOrder: photo.sortOrder,
        })),
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить фотографию. Попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function save() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const items = orderedSelectedIds.map((photoId, index) => ({
        photoId,
        order: index,
      }));
      const response = await fetch(`/api/sale-listings/${listing.id}/photos`, {
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

  function moveSelected(photoId: string, delta: number) {
    setSelected((current) => {
      const ids = Object.entries(current)
        .filter(([, state]) => state.selected)
        .sort((left, right) => left[1].order - right[1].order)
        .map(([id]) => id);
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
        next[id] = { selected: true, order: index };
      });
      return next;
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Фото для продажи</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Файлы принадлежат объекту. Здесь выбирается, какие из них показывать в карточке продажи.
          Первое выбранное фото — обложка.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      ) : null}
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={pending}
            onChange={(event) => void uploadFiles(event.target.files)}
            className="sr-only"
            id="sale-photo-upload"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Загрузить с компьютера или телефона
            </button>
            <p className="text-xs text-zinc-500">JPEG, PNG, WebP · до 10 МБ · можно несколько файлов</p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-zinc-500">Или добавьте по ссылке:</p>
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
              onClick={() => void addPhotoByUrl()}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Добавить в пул объекта
            </button>
          </div>
        </div>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-zinc-500">У объекта пока нет фотографий.</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((photo) => {
            const state = selected[photo.id] ?? { selected: false, order: 0 };
            const isCover = coverId === photo.id;
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
                    checked={state.selected}
                    onChange={(event) =>
                      setSelected((current) => {
                        if (!event.target.checked) {
                          const { [photo.id]: _removed, ...rest } = current;
                          void _removed;
                          const remaining = Object.entries(rest)
                            .filter(([, item]) => item.selected)
                            .sort((left, right) => left[1].order - right[1].order)
                            .map(([id]) => id);
                          const next = { ...rest };
                          remaining.forEach((id, index) => {
                            next[id] = { selected: true, order: index };
                          });
                          return next;
                        }
                        return {
                          ...current,
                          [photo.id]: {
                            selected: true,
                            order: Object.values(current).filter((item) => item.selected).length,
                          },
                        };
                      })
                    }
                  />
                  В карточке продажи
                </label>
                {isCover ? (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
                    Обложка
                  </span>
                ) : null}
                {state.selected ? (
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveSelected(photo.id, -1)}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                    >
                      Выше
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelected(photo.id, 1)}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                    >
                      Ниже
                    </button>
                  </div>
                ) : null}
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
