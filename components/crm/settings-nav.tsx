"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/crm/settings", label: "Общие", exact: true },
  { href: "/crm/settings/integrations", label: "Интеграции", exact: false },
  { href: "/crm/settings/integrations/logs", label: "Журнал синхронизации", exact: true },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  if (href === "/crm/settings/integrations") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && !pathname.startsWith("/crm/settings/integrations/logs"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-[var(--finance-border)] bg-white p-1"
      aria-label="Настройки"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                : "text-[var(--finance-text-secondary)] hover:bg-[var(--finance-hover)] hover:text-[var(--finance-text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
