import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--finance-border)] bg-white px-6 py-12 text-center ${className}`.trim()}
    >
      <p className="text-base font-semibold text-[var(--finance-text)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--finance-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
