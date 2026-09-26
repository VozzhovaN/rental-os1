"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import type { PresentationKind } from "@prisma/client";

type Props = {
  propertyId: string;
  propertyName: string;
  /** Presentation contour. Default SHORT_TERM for CRM property cards. */
  kind?: Exclude<PresentationKind, "COLLECTION">;
  /** Show «Опубликовать» (public link + PDF for clients). */
  showPublish?: boolean;
  /** Visual density for cards vs detail header. */
  compact?: boolean;
  /** Extra-compact buttons for dense sale table rows. */
  dense?: boolean;
  className?: string;
};

type CreatedPresentation = { id: string };

async function createPresentation(input: {
  propertyId: string;
  propertyName: string;
  kind: Exclude<PresentationKind, "COLLECTION">;
}): Promise<CreatedPresentation> {
  const createResponse = await fetch("/api/presentations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      propertyIds: [input.propertyId],
      title: input.propertyName,
    }),
  });
  const createPayload = (await createResponse.json()) as {
    error?: string;
    details?: string[];
    presentation?: CreatedPresentation;
  };
  if (!createResponse.ok || !createPayload.presentation) {
    throw new Error(
      createPayload.details?.join(". ") ||
        createPayload.error ||
        "Не удалось создать презентацию",
    );
  }
  return createPayload.presentation;
}

async function downloadPdfBlob(input: {
  presentationId: string;
  publicToken?: string | null;
}): Promise<Blob> {
  const pdfPath = input.publicToken
    ? `/api/p/${input.publicToken}/pdf`
    : `/api/presentations/${input.presentationId}/pdf`;
  const pdfResponse = await fetch(pdfPath);
  if (!pdfResponse.ok) {
    throw new Error("Не удалось сформировать PDF");
  }
  return pdfResponse.blob();
}

async function shareOrDownloadPdfFile(input: {
  blob: Blob;
  propertyName: string;
  mailtoBody?: string;
}) {
  const safeName =
    input.propertyName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "presentation";
  const fileName = `${safeName}.pdf`;
  const file = new File([input.blob], fileName, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      title: `Презентация: ${input.propertyName}`,
      text: `Презентация объекта «${input.propertyName}»`,
      files: [file],
    });
    return { shared: true as const, fileName };
  }

  const objectUrl = URL.createObjectURL(input.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  const subject = encodeURIComponent(`Презентация: ${input.propertyName}`);
  const body = encodeURIComponent(
    input.mailtoBody ??
      `Здравствуйте!\n\nВо вложении презентация объекта «${input.propertyName}».\n\nPDF сохранён на устройство — приложите файл «${fileName}» к этому письму.\n`,
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  return { shared: false as const, fileName };
}

export async function sendPropertyPresentationPdf(input: {
  propertyId: string;
  propertyName: string;
  kind?: Exclude<PresentationKind, "COLLECTION">;
}): Promise<void> {
  const kind = input.kind ?? "SHORT_TERM";
  const presentation = await createPresentation({
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    kind,
  });
  const blob = await downloadPdfBlob({ presentationId: presentation.id });
  await shareOrDownloadPdfFile({ blob, propertyName: input.propertyName });
}

/**
 * Create SALE/… presentation, publish it, then share the public page + PDF with the client.
 */
export async function publishAndSendPropertyPresentation(input: {
  propertyId: string;
  propertyName: string;
  kind?: Exclude<PresentationKind, "COLLECTION">;
}): Promise<{ publicToken: string; publicUrl: string }> {
  const kind = input.kind ?? "SALE";
  const created = await createPresentation({
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    kind,
  });

  const publishResponse = await fetch(`/api/presentations/${created.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PUBLISHED" }),
  });
  const publishPayload = (await publishResponse.json()) as {
    error?: string;
    details?: string[];
    presentation?: { id: string; publicToken: string };
  };
  if (!publishResponse.ok || !publishPayload.presentation?.publicToken) {
    throw new Error(
      publishPayload.details?.join(". ") ||
        publishPayload.error ||
        "Не удалось опубликовать презентацию",
    );
  }

  const token = publishPayload.presentation.publicToken;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/p/${token}`;
  const pdfUrl = `${origin}/api/p/${token}/pdf`;

  const blob = await downloadPdfBlob({
    presentationId: created.id,
    publicToken: token,
  });
  await shareOrDownloadPdfFile({
    blob,
    propertyName: input.propertyName,
    mailtoBody: `Здравствуйте!\n\nПодборка по объекту «${input.propertyName}»:\n\nСмотреть онлайн: ${publicUrl}\nСкачать PDF: ${pdfUrl}\n\nPDF также сохранён на устройство — при необходимости приложите файл к письму.\n`,
  });

  return { publicToken: token, publicUrl };
}

/**
 * Shared property actions: create a presentation draft, generate PDF, or publish for clients.
 */
export function PropertyPresentationActions({
  propertyId,
  propertyName,
  kind = "SHORT_TERM",
  showPublish = false,
  compact = false,
  dense = false,
  className,
}: Props) {
  const [pending, setPending] = useState<"pdf" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const createHref = `/crm/presentations/new?propertyId=${propertyId}&kind=${kind}`;

  async function sendPdf(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    setError(null);
    setPending("pdf");
    try {
      await sendPropertyPresentationPdf({ propertyId, propertyName, kind });
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Не удалось отправить PDF",
      );
    } finally {
      setPending(null);
    }
  }

  async function publish(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    setError(null);
    setPending("publish");
    try {
      const result = await publishAndSendPropertyPresentation({
        propertyId,
        propertyName,
        kind,
      });
      setPublishedUrl(result.publicUrl);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Не удалось опубликовать презентацию",
      );
    } finally {
      setPending(null);
    }
  }

  const btn = dense
    ? "inline-flex rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-white disabled:opacity-60"
    : compact
      ? "inline-flex rounded-lg border border-[var(--finance-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)] disabled:opacity-60"
      : "inline-flex rounded-xl border border-[var(--finance-border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)] disabled:opacity-60";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={createHref}
          className={btn}
          onClick={(e) => e.stopPropagation()}
          title="Создать презентацию"
        >
          {dense ? "Презент." : "Презентация"}
        </Link>
        <button
          type="button"
          className={btn}
          disabled={pending != null}
          onClick={sendPdf}
          title="Сформировать PDF и отправить"
        >
          {pending === "pdf" ? "PDF…" : "PDF"}
        </button>
        {showPublish ? (
          <button
            type="button"
            className={btn}
            disabled={pending != null}
            onClick={publish}
            title="Опубликовать презентацию и отправить клиенту"
          >
            {pending === "publish" ? "Публ…" : "Опубликовать"}
          </button>
        ) : null}
      </div>
      {publishedUrl ? (
        <p className="mt-1 max-w-[18rem] truncate text-[11px] text-emerald-700">
          <a href={publishedUrl} target="_blank" rel="noreferrer" className="underline">
            Открыть публичную ссылку
          </a>
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 max-w-[16rem] text-[11px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
