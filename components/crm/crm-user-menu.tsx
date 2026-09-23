"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CrmUserMenu({ email, name }: { email: string; name: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = name?.trim() || email;

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
    <div className="ml-auto flex items-center gap-3 text-sm text-zinc-600">
      <span className="max-w-[14rem] truncate" title={email}>
        {label}
      </span>
      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
      >
        {busy ? "…" : "Выйти"}
      </button>
    </div>
  );
}
