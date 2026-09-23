"use client";

import { useRef, useState } from "react";
import { uploadPropertyPhotos } from "@/lib/property-photo-client";
import type { PropertyPhotoDTO } from "@/lib/property-photos";

type UploadItem = {
  id: string;
  name: string;
  progress: "uploading" | "done" | "error";
  error?: string;
};

export function PropertyPhotoGallery({
  propertyId,
  initialPhotos,
}: {
  propertyId: string;
  initialPhotos: PropertyPhotoDTO[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[] | null) {
    if (!fileList || (Array.isArray(fileList) ? fileList.length === 0 : fileList.length === 0)) {
      return;
    }
    const files = Array.from(fileList);
    setError(null);
    setPending(true);

    const items: UploadItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name || `photo-${index + 1}`,
      progress: "uploading",
    }));
    setUploads(items);

    try {
      const uploaded = await uploadPropertyPhotos(propertyId, files);
      setPhotos((current) => [...current, ...uploaded]);
      setUploads((current) => current.map((item) => ({ ...item, progress: "done" })));
      window.setTimeout(() => setUploads([]), 800);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить фотографию. Попробуйте ещё раз.";
      setError(message);
      setUploads((current) =>
        current.map((item) => ({ ...item, progress: "error", error: message })),
      );
    } finally {
      setPending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function setCover(photoId: string) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setCover" }),
      });
      const payload = (await response.json()) as { error?: string; photo?: PropertyPhotoDTO };
      if (!response.ok || !payload.photo) {
        throw new Error(payload.error || "Не удалось сделать фотографию обложкой");
      }
      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          isCover: photo.id === photoId,
        })),
      );
    } catch (coverError) {
      setError(
        coverError instanceof Error ? coverError.message : "Не удалось сделать фотографию обложкой",
      );
    } finally {
      setPending(false);
    }
  }

  async function removePhoto(photoId: string) {
    if (!window.confirm("Удалить фотографию?")) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось удалить фотографию.");
      }
      setPhotos((current) => {
        const remaining = current.filter((photo) => photo.id !== photoId);
        if (remaining.length === 0) {
          return remaining;
        }
        const hadCover = current.find((photo) => photo.id === photoId)?.isCover;
        if (!hadCover) {
          return remaining;
        }
        const [first, ...rest] = remaining;
        return [{ ...first, isCover: true }, ...rest.map((photo) => ({ ...photo, isCover: false }))];
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Не удалось удалить фотографию.",
      );
    } finally {
      setPending(false);
    }
  }

  async function persistOrder(nextPhotos: PropertyPhotoDTO[]) {
    setPhotos(nextPhotos);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/photos/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: nextPhotos.map((photo) => photo.id) }),
      });
      const payload = (await response.json()) as { error?: string; photos?: PropertyPhotoDTO[] };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить порядок");
      }
      if (payload.photos) {
        setPhotos(payload.photos);
      }
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "Не удалось сохранить порядок",
      );
    } finally {
      setPending(false);
    }
  }

  function movePhoto(photoId: string, delta: number) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= photos.length) {
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void persistOrder(next.map((photo, order) => ({ ...photo, sortOrder: order })));
  }

  function onDropReorder(targetId: string) {
    if (!dragPhotoId || dragPhotoId === targetId) {
      setDragPhotoId(null);
      return;
    }
    const from = photos.findIndex((photo) => photo.id === dragPhotoId);
    const to = photos.findIndex((photo) => photo.id === targetId);
    if (from < 0 || to < 0) {
      setDragPhotoId(null);
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragPhotoId(null);
    void persistOrder(next.map((photo, order) => ({ ...photo, sortOrder: order })));
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Фотографии</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Общий пул объекта для карточки, посуточной аренды, долгосрочной аренды и продажи.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Добавить фото
        </button>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={pending}
        onChange={(event) => void uploadFiles(event.target.files)}
      />

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files?.length) {
            void uploadFiles(event.dataTransfer.files);
          }
        }}
        className={`rounded-lg border border-dashed px-4 py-8 text-center ${
          dragOver ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-zinc-50"
        }`}
      >
        <p className="text-sm text-zinc-700">Перетащите фотографии сюда</p>
        <p className="mt-1 text-xs text-zinc-500">или</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          Выбрать файлы
        </button>
        <p className="mt-2 text-xs text-zinc-500">JPEG, PNG, WebP · до 10 МБ</p>
      </div>

      {uploads.length > 0 ? (
        <ul className="space-y-2">
          {uploads.map((item) => (
            <li key={item.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-zinc-500">
                  {item.progress === "uploading"
                    ? "Загрузка..."
                    : item.progress === "done"
                      ? "Готово"
                      : "Ошибка"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-100">
                <div
                  className={`h-full ${
                    item.progress === "error"
                      ? "w-full bg-red-400"
                      : item.progress === "done"
                        ? "w-full bg-emerald-500"
                        : "w-2/3 animate-pulse bg-zinc-800"
                  }`}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 7h3l2-2h6l2 2h3v12H4V7z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </div>
          <p className="mt-4 font-medium text-zinc-800">У объекта пока нет фото</p>
          <p className="mt-1 text-sm text-zinc-500">
            Добавьте фотографии для карточки и объявлений
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + Добавить фотографии
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragPhotoId(photo.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDropReorder(photo.id)}
              className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.originalFileName || ""}
                className="aspect-[4/3] w-full object-cover"
              />
              {photo.isCover ? (
                <span className="absolute left-2 top-2 rounded bg-zinc-900/85 px-2 py-0.5 text-xs font-medium text-white">
                  ★ Обложка
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending || photo.isCover}
                    onClick={() => void setCover(photo.id)}
                    aria-label="Сделать фотографию обложкой"
                    title="Сделать фотографию обложкой"
                    className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-900 disabled:opacity-40"
                  >
                    Обложка
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void removePhoto(photo.id)}
                    aria-label="Удалить фотографию"
                    title="Удалить фотографию"
                    className="rounded bg-white/90 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                  >
                    Удалить
                  </button>
                </div>
                <div className="flex gap-1 sm:hidden">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => movePhoto(photo.id, -1)}
                    className="rounded bg-white/90 px-2 py-1 text-xs"
                    aria-label="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => movePhoto(photo.id, 1)}
                    className="rounded bg-white/90 px-2 py-1 text-xs"
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
