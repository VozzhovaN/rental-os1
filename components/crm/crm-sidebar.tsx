"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBuilding,
  IconCalendar,
  IconFolder,
  IconHouse,
  IconKey,
  IconLayout,
  IconSettings,
  IconTag,
  IconUsers,
  IconWallet,
} from "@/components/crm/icons";

const MAIN_NAV = [
  { href: "/crm/dashboard", label: "Dashboard", icon: IconLayout, match: "exact" as const },
  { href: "/crm/properties", label: "Объекты", icon: IconBuilding, match: "prefix" as const },
  { href: "/crm/guests", label: "Гости", icon: IconUsers, match: "prefix" as const },
  { href: "/crm/bookings", label: "Бронирования", icon: IconCalendar, match: "prefix" as const },
  {
    href: "/crm/long-term",
    label: "Долгосрочная аренда",
    icon: IconKey,
    match: "prefix" as const,
  },
  { href: "/crm/sales/properties", label: "Продажи", icon: IconTag, match: "sales" as const },
  {
    href: "/crm/presentations",
    label: "Презентации",
    icon: IconFolder,
    match: "prefix" as const,
  },
  { href: "/crm/finance", label: "Финансы", icon: IconWallet, match: "finance" as const },
] as const;

const FINANCE_SUB = [
  { href: "/crm/finance", label: "Обзор", exact: true },
  { href: "/crm/finance/properties", label: "Объекты", exact: false },
  { href: "/crm/finance/operations", label: "Операции", exact: false },
  { href: "/crm/finance/commissions", label: "Комиссии", exact: false },
  { href: "/crm/finance/expenses", label: "Расходы", exact: false },
  { href: "/crm/finance/reports", label: "Отчёты", exact: false },
] as const;

function isActive(pathname: string, href: string, match: string) {
  if (match === "exact") return pathname === href;
  if (match === "finance") return pathname === "/crm/finance" || pathname.startsWith("/crm/finance/");
  if (match === "sales") {
    return pathname === "/crm/sales" || pathname.startsWith("/crm/sales/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export function CrmSidebar({ mobileOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const financeOpen = pathname.startsWith("/crm/finance");

  const panel = (
    <aside className="finance-sidebar flex h-full w-[176px] flex-col border-r border-[var(--finance-sidebar-border)] bg-white">
      <div className="flex h-14 items-center gap-2.5 px-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9FAF4] text-[var(--finance-green)]">
          <IconHouse size={18} />
        </span>
        <span className="text-[18px] font-bold tracking-tight text-[var(--finance-text)]">
          Rental OS
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-1" aria-label="CRM">
        <ul className="space-y-0.5">
          {MAIN_NAV.map((item) => {
            const active = isActive(pathname, item.href, item.match);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={item.label}
                  className={`relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-[var(--finance-blue-light)] font-semibold text-[var(--finance-blue)]"
                      : "font-medium text-[#3A4863] hover:bg-[var(--finance-hover)]"
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-[var(--finance-blue)]"
                      aria-hidden
                    />
                  ) : null}
                  <Icon
                    size={17}
                    className={`shrink-0 ${active ? "text-[var(--finance-blue)]" : "text-[#6B7A95]"}`}
                  />
                  <span className="line-clamp-2 leading-tight">{item.label}</span>
                </Link>

                {item.match === "finance" && financeOpen ? (
                  <ul className="mt-0.5 mb-1 ml-[46px] space-y-0.5">
                    {FINANCE_SUB.map((sub) => {
                      const subActive = sub.exact
                        ? pathname === sub.href
                        : pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            onClick={onClose}
                            className={`block rounded-md px-2 py-1.5 text-[12.5px] leading-5 transition-colors ${
                              subActive
                                ? "bg-[var(--finance-blue-light)] font-semibold text-[var(--finance-blue)]"
                                : "text-[#65738F] hover:bg-[var(--finance-hover)] hover:text-[#3A4863]"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-[var(--finance-sidebar-border)] pt-3">
          <Link
            href="/crm/settings/integrations"
            onClick={onClose}
            className={`flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
              pathname.startsWith("/crm/settings")
                ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                : "text-[#3A4863] hover:bg-[var(--finance-hover)]"
            }`}
          >
            <IconSettings size={17} className="text-[#6B7A95]" />
            Настройки
          </Link>
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">{panel}</div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#101B3A]/35"
            aria-label="Закрыть меню"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 shadow-xl">{panel}</div>
        </div>
      ) : null}
    </>
  );
}
