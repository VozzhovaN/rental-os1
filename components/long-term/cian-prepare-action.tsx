"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  listingId: string;
  canPrepare: boolean;
};

export function CianPrepareAction({ listingId, canPrepare }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function prepare() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/long-term-listings/${listingId}/publications/cian/prepare`,
        { method: "POST" },
      );
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        publication?: { status?: string };
      };
      if (!response.ok) {
        throw new Error(body.error || "Не удалось подготовить публикацию");
      }
      setMessage(
        body.message ||
          `Статус: ${body.publication?.status ?? "PUBLISHING"}. PUBLISHED без подтверждения ЦИАН не выставляется.`,
      );
      router.refresh();
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Ошибка подготовки");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!canPrepare || pending}
        onClick={prepare}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Подготовка..." : "Подготовить к публикации в ЦИАН"}
      </button>
      <p className="text-xs text-zinc-500">
        Переводит Publication в PUBLISHING и включает объект в публичный фид. Статус «Опубликовано»
        без подтверждения площадки не ставится.
      </p>
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
