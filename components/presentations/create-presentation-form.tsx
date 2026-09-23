"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PropertyDTO } from "@/lib/properties";
import { presentationKindLabels } from "@/lib/presentation-labels";
import type { PresentationKind } from "@prisma/client";

export function CreatePresentationForm({
  properties,
  longTermPropertyIds,
  salePropertyIds,
  initialPropertyId,
  initialKind,
}: {
  properties: PropertyDTO[];
  longTermPropertyIds: string[];
  salePropertyIds: string[];
  initialPropertyId?: string;
  initialKind?: PresentationKind;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PresentationKind>(
    initialKind ?? "SHORT_TERM",
  );
  const [selected, setSelected] = useState<string[]>(
    initialPropertyId ? [initialPropertyId] : [],
  );
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const ltSet = useMemo(() => new Set(longTermPropertyIds), [longTermPropertyIds]);
  const saleSet = useMemo(() => new Set(salePropertyIds), [salePropertyIds]);

  const available = properties.filter((property) => {
    if (kind === "LONG_TERM") return ltSet.has(property.id);
    if (kind === "SALE") return saleSet.has(property.id);
    return true;
  });

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          propertyIds: selected,
          title: title.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        details?: string[];
        presentation?: { id: string };
      };
      if (!response.ok || !payload.presentation) {
        throw new Error(
          payload.details?.join(". ") ||
            payload.error ||
            "Не удалось создать презентацию",
        );
      }
      router.push(`/crm/presentations/${payload.presentation.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать презентацию",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}

      <section className="finance-card space-y-3 p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
          Тип презентации
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(presentationKindLabels) as PresentationKind[]).map(
            (value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  kind === value
                    ? "border-[var(--finance-blue)] bg-[var(--finance-blue-light)]"
                    : "border-[var(--finance-border)]"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  checked={kind === value}
                  onChange={() => {
                    setKind(value);
                    setSelected((ids) =>
                      ids.filter((id) => {
                        if (value === "LONG_TERM") return ltSet.has(id);
                        if (value === "SALE") return saleSet.has(id);
                        return true;
                      }),
                    );
                  }}
                />
                {presentationKindLabels[value]}
              </label>
            ),
          )}
        </div>
      </section>

      <section className="finance-card space-y-3 p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
          Название
        </h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Необязательно — сгенерируется из объектов"
          className="w-full rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm outline-none focus:border-[var(--finance-blue)]"
        />
      </section>

      <section className="finance-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
            Объекты (1–5)
          </h2>
          <span className="text-xs text-[var(--finance-text-muted)]">
            выбрано {selected.length}
          </span>
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-[var(--finance-text-secondary)]">
            Нет подходящих объектов для выбранного типа.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {available.map((property) => (
              <li key={property.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--finance-hover)]">
                  <input
                    type="checkbox"
                    checked={selected.includes(property.id)}
                    onChange={() => toggle(property.id)}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{property.name}</span>
                    <span className="text-[var(--finance-text-muted)]">
                      {" "}
                      · {property.city}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || selected.length === 0}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Создание..." : "Создать и открыть редактор"}
        </button>
      </div>
    </div>
  );
}
