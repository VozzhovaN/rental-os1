"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClassName =
  "w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/15";

export function GuestNoteForm({ guestId }: { guestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "").trim();

    try {
      const response = await fetch(`/api/guests/${guestId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NOTE",
          title: note.slice(0, 80) || "Заметка",
          description: note,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        details?: string[];
      };

      if (!response.ok) {
        throw new Error(
          result.details?.join(". ") ||
            result.error ||
            "Не удалось добавить заметку",
        );
      }

      form.reset();
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось добавить заметку",
      );
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
      >
        + Добавить заметку
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-[var(--finance-hover)] p-4">
      {error ? (
        <p className="text-sm text-[var(--finance-red)]" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--finance-text)]">
          Заметка
        </span>
        <textarea
          name="note"
          required
          rows={3}
          className={inputClassName}
          placeholder="Текст заметки"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--finance-blue)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
