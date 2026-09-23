"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/crm/dashboard", label: "Dashboard", match: "exact" as const },
  { href: "/crm/properties", label: "Объекты", match: "prefix" as const },
  { href: "/crm/guests", label: "Гости", match: "prefix" as const },
  { href: "/crm/bookings", label: "Бронирования", match: "prefix" as const },
  { href: "/crm/long-term", label: "Долгосрочная аренда", match: "prefix" as const },
  { href: "/crm/finance", label: "Финансы", match: "prefix" as const },
  { href: "/crm/sales/properties", label: "Продажи · Объекты", match: "sales-properties" as const },
  { href: "/crm/sales/clients", label: "Продажи · Клиенты", match: "sales-clients" as const },
  { href: "/crm/settings/integrations", label: "Настройки", match: "settings" as const },
];

export function CrmNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {navItems.map((item) => {
        const active =
          item.match === "exact"
            ? pathname === item.href
            : item.match === "settings"
              ? pathname.startsWith("/crm/settings")
              : item.match === "sales-properties"
                ? pathname === "/crm/sales" || pathname.startsWith("/crm/sales/properties")
                : item.match === "sales-clients"
                  ? pathname.startsWith("/crm/sales/clients")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
