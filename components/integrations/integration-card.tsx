import Link from "next/link";
import { StatusBadge, type StatusBadgeTone } from "@/components/crm/status-badge";

type Props = {
  title: string;
  purpose: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  capabilities: string[];
  lastSuccess?: string | null;
  actionHref: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  note?: string;
};

export function IntegrationCard({
  title,
  purpose,
  statusLabel,
  statusTone,
  capabilities,
  lastSuccess,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  note,
}: Props) {
  return (
    <article className="finance-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">{title}</h2>
        <StatusBadge tone={statusTone} dot>
          {statusLabel}
        </StatusBadge>
      </div>

      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">{purpose}</p>

      <ul className="mt-4 space-y-1.5 text-sm text-[var(--finance-text)]">
        {capabilities.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[var(--finance-text-muted)]" aria-hidden>
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {lastSuccess ? (
        <p className="mt-3 text-xs text-[var(--finance-text-muted)]">
          Последнее успешное действие: {lastSuccess}
        </p>
      ) : null}

      {note ? (
        <p className="mt-3 rounded-lg bg-[var(--finance-hover)] px-3 py-2 text-xs text-[var(--finance-text-secondary)]">
          {note}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--finance-blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {actionLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
