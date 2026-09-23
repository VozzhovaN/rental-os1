"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

export function GuestHistoryForm({ guestId }: { guestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch(`/api/guests/${guestId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: String(data.get("type")),
          title: String(data.get("title") ?? "").trim(),
          description: String(data.get("description") ?? "").trim(),
        }),
      });
      const result = (await response.json()) as { error?: string; details?: string[] };

      if (!response.ok) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось добавить запись");
      }

      form.reset();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось добавить запись");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-zinc-50 p-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <select name="type" className={inputClassName} defaultValue="NOTE">
          <option value="NOTE">Заметка</option>
          <option value="CONTACT">Обращение</option>
          <option value="MESSAGE">Сообщение</option>
        </select>
        <input name="title" required placeholder="Заголовок" className={inputClassName} />
        <input name="description" placeholder="Описание" className={inputClassName} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Сохранение..." : "Добавить в историю"}
      </button>
    </form>
  );
}
