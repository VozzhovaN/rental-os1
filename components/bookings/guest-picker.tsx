"use client";

import { useMemo, useState } from "react";
import { formatGuestName } from "@/lib/format";
import { guestMatchesQuery } from "@/lib/guest-search";
import type { GuestDTO } from "@/lib/guests";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

export function GuestPicker({
  guests,
  value,
  onChange,
  onCreateNew,
}: {
  guests: GuestDTO[];
  value: string;
  onChange: (guestId: string) => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = guests.find((guest) => guest.id === value);
  const matches = useMemo(
    () => guests.filter((guest) => guestMatchesQuery(guest, query)).slice(0, 12),
    [guests, query],
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name="guestId" value={value} />
      {selected ? (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium">{formatGuestName(selected)}</p>
            <p className="text-xs text-zinc-500">
              {[selected.phone, selected.email].filter(Boolean).join(" · ") || "без контактов"}
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-800"
            onClick={() => onChange("")}
          >
            Сменить
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск гостя..."
            className={inputClassName}
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-500">Гости не найдены</p>
            ) : (
              <ul>
                {matches.map((guest) => (
                  <li key={guest.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                      onClick={() => {
                        onChange(guest.id);
                        setQuery("");
                      }}
                    >
                      <span className="block font-medium">{formatGuestName(guest)}</span>
                      <span className="block text-xs text-zinc-500">
                        {[guest.phone, guest.email].filter(Boolean).join(" · ") || "без контактов"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onCreateNew}
        className="text-sm font-medium text-zinc-800 hover:underline"
      >
        + Новый гость
      </button>
    </div>
  );
}
