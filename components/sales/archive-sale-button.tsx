"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveSaleButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    const confirmed = window.confirm(
      "Архивировать карточку продажи? Запись не удаляется, восстановление на этом этапе невозможно.",
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/sale-listings/${listingId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось архивировать");
      }
      router.push("/crm/sales/properties");
      router.refresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Не удалось архивировать");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void archive()}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Архивация..." : "Архивировать"}
      </button>
    </div>
  );
}
