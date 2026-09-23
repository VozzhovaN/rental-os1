"use client";

import { useState } from "react";

type Props = {
  listingId: string;
  ready: boolean;
};

export function CianXmlPreviewActions({ listingId, ready }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const previewUrl = `/api/long-term-listings/${listingId}/publications/cian/preview`;
  const downloadUrl = `${previewUrl}?download=1`;

  async function loadPreview() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(previewUrl, {
        headers: { Accept: "application/json" },
      });
      const body = (await response.json()) as {
        ready?: boolean;
        xml?: string | null;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!response.ok || !body.ready || !body.xml) {
        const details = body.errors?.map((item) => item.message).join(". ");
        throw new Error(details || body.error || "XML недоступен");
      }
      setXml(body.xml);
      setOpen(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить preview");
      setOpen(true);
      setXml(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={loadPreview}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Загрузка..." : "Предпросмотр XML CIAN"}
        </button>
        {ready ? (
          <a
            href={downloadUrl}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            Скачать XML
          </a>
        ) : (
          <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400">
            Скачать XML
          </span>
        )}
      </div>

      {open ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Preview XML CIAN
            </p>
            <button
              type="button"
              className="text-xs text-zinc-500 underline"
              onClick={() => setOpen(false)}
            >
              Закрыть
            </button>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {xml ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-800">
              {xml}
            </pre>
          ) : null}
          <p className="text-xs text-zinc-400">
            Это локальный preview. Объявление в ЦИАН не отправлено.
          </p>
        </div>
      ) : null}
    </div>
  );
}
