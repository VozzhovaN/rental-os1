"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/crm/finance", label: "Обзор", exact: true },
  { href: "/crm/finance/properties", label: "Объекты", exact: false },
  { href: "/crm/finance/operations", label: "Операции", exact: false },
  { href: "/crm/finance/commissions", label: "Комиссии", exact: false },
  { href: "/crm/finance/expenses", label: "Расходы", exact: false },
  { href: "/crm/finance/reports", label: "Отчёты", exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FinanceSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы финансов"
      className="mb-4 flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"
    >
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
