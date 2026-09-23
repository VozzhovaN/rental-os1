import type { ReactNode } from "react";

export type StatusBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info"
  | "muted";

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  success: "bg-[var(--finance-green-light)] text-[var(--finance-green)]",
  warning: "bg-[#FFF4E8] text-[#D97706]",
  danger: "bg-[var(--finance-red-light)] text-[var(--finance-red)]",
  neutral: "bg-[#F1F5F9] text-[#64748B]",
  info: "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]",
  muted: "bg-[#F1F5F9] text-[#8995AA]",
};

type Props = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  dot?: boolean;
  className?: string;
};

export function StatusBadge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {dot ? (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            tone === "success"
              ? "bg-[var(--finance-green)]"
              : tone === "warning"
                ? "bg-[#D97706]"
                : tone === "danger"
                  ? "bg-[var(--finance-red)]"
                  : tone === "info"
                    ? "bg-[var(--finance-blue)]"
                    : "bg-[#94A3B8]"
          }`}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
