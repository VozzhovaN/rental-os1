"use client";

import { useState, type ReactNode } from "react";
import { CrmSidebar, CRM_SIDEBAR_WIDTH_CLASS } from "@/components/crm/crm-sidebar";
import { IconChevronDown, IconMenu } from "@/components/crm/icons";
import { useRouter } from "next/navigation";

type Props = {
  email: string;
  name: string | null;
  children: ReactNode;
};

export function CrmShell({ email, name, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const displayName = name?.trim() || email;
  const initials = (name?.trim() || email)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-[var(--finance-bg)] text-[var(--finance-text)]">
      <CrmSidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className={CRM_SIDEBAR_WIDTH_CLASS}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#EDF1F6] bg-white/94 px-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#65738F] hover:bg-[var(--finance-hover)] md:hidden"
            aria-label="Открыть меню"
            onClick={() => setMenuOpen(true)}
          >
            <IconMenu size={20} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 hover:bg-[var(--finance-hover)] focus-visible:outline-2 focus-visible:outline-[var(--finance-blue)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--finance-blue-light)] text-xs font-semibold text-[var(--finance-blue)]">
                  {initials || "U"}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[10rem] truncate text-[13px] font-semibold text-[var(--finance-text)]">
                    {displayName}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--finance-text-muted)]">
                    {email}
                  </span>
                </span>
                <IconChevronDown className="hidden text-[#8995AA] sm:block" />
              </button>

              {userOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-44 rounded-lg border border-[var(--finance-border)] bg-white py-1 shadow-[var(--finance-shadow)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={onLogout}
                    className="w-full px-3 py-2 text-left text-[13px] text-[var(--finance-text)] hover:bg-[var(--finance-hover)] disabled:opacity-60"
                  >
                    {busy ? "…" : "Выйти"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 pt-5 pb-10 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
