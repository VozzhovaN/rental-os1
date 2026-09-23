"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CianSalePrepareAction({
  saleListingId,
  canPrepare,
}: {
  saleListingId: string;
  canPrepare: boolean;
}) {
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
        `/api/sale-listings/${saleListingId}/publications/cian/prepare`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        published?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось подготовить");
      }
      setMessage(payload.message || "Подготовлено к отправке");
      router.refresh();
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Не удалось подготовить");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!canPrepare || pending}
        onClick={() => void prepare()}
        className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "Подготовка..." : "Подготовить к публикации"}
      </button>
      {message ? <p className="text-xs font-medium text-emerald-800">{message}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
