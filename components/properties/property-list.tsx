"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  IconBuilding,
  IconCalendar,
  IconPlus,
  IconTag,
  IconWallet,
} from "@/components/crm/icons";
import { dashboardHref } from "@/lib/dashboard";
import type { PropertyDTO } from "@/lib/properties";
import {
  managementTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/lib/property-labels";
import { PropertyPresentationActions, sendPropertyPresentationPdf } from "@/components/properties/property-presentation-actions";

export type PropertyListDirections = {
  longTermListingId: string | null;
  saleListingId: string | null;
};

export type PropertyListItem = PropertyDTO & {
  directions: PropertyListDirections;
};

type ViewMode = "cards" | "table";

const VIEW_STORAGE_KEY = "rental-os:properties-view-mode";
const VIEW_EVENT = "rental-os:properties-view-mode-changed";

function subscribeViewMode(onStoreChange: () => void) {
  window.addEventListener(VIEW_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readViewMode(): ViewMode {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "cards" || raw === "table") return raw;
  } catch {
    /* ignore */
  }
  return "cards";
}

function writeViewMode(next: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

const statusBadgeClass = {
  ACTIVE: "bg-[var(--finance-green-light)] text-[var(--finance-green)]",
  INACTIVE: "bg-[#F1F5F9] text-[#64748B]",
  ARCHIVED: "bg-[#FFF7ED] text-[#C2410C]",
} as const;

const managementBadgeClass = {
  OWN: "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]",
  COMMISSION: "bg-[#F5F3FF] text-[#7C3AED]",
} as const;

function StatusBadge({ status }: { status: PropertyDTO["status"] }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[status]}`}
    >
      {propertyStatusLabels[status]}
    </span>
  );
}

function ManagementBadge({ type }: { type: PropertyDTO["managementType"] }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${managementBadgeClass[type]}`}
    >
      {managementTypeLabels[type]}
    </span>
  );
}

function CoverThumb({
  property,
  className,
}: {
  property: PropertyDTO;
  className?: string;
}) {
  if (property.coverPhotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={property.coverPhotoUrl}
        alt={property.name}
        className={className ?? "h-full w-full max-w-none object-cover"}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[#EEF3F9] text-[#94A3B8] ${className ?? ""}`}
      aria-hidden
    >
      <IconBuilding size={28} />
    </div>
  );
}

function DirectionChips({ item }: { item: PropertyListItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#475569]">
        Посуточно
      </span>
      {item.directions.longTermListingId ? (
        <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#2563EB]">
          Долгосрок
        </span>
      ) : null}
      {item.directions.saleListingId ? (
        <span className="rounded-md bg-[#F5F3FF] px-2 py-0.5 text-[11px] font-medium text-[#7C3AED]">
          Продажа
        </span>
      ) : null}
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-[var(--finance-green)]" : "text-[#94A3B8]"}>
      {value ? "Да" : "—"}
    </span>
  );
}

function QuickActionsMenu({ item }: { item: PropertyListItem }) {
  const [open, setOpen] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const now = new Date();
  const calendarHref = dashboardHref({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    date: now.toISOString().slice(0, 10),
    propertyId: item.id,
  });

  const actions: { href: string; label: string }[] = [
    { href: `/crm/properties/${item.id}/edit`, label: "Редактировать" },
    { href: calendarHref, label: "Открыть календарь" },
    { href: `/crm/bookings/new?propertyId=${item.id}`, label: "Добавить бронь" },
    {
      href: `/crm/presentations/new?propertyId=${item.id}&kind=SHORT_TERM`,
      label: "Создать презентацию",
    },
  ];

  if (item.directions.longTermListingId) {
    actions.push({
      href: `/crm/long-term/${item.directions.longTermListingId}`,
      label: "Открыть долгосрок",
    });
  }

  if (item.directions.saleListingId) {
    actions.push({
      href: `/crm/sales/properties/${item.directions.saleListingId}`,
      label: "Открыть продажу",
    });
  }

  actions.push({
    href: `/crm/finance/properties/${item.id}`,
    label: "Финансы объекта",
  });

  async function sendPdf(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pdfPending) return;
    setPdfError(null);
    setPdfPending(true);
    try {
      await sendPropertyPresentationPdf({
        propertyId: item.id,
        propertyName: item.name,
      });
      setOpen(false);
    } catch (sendError) {
      setPdfError(
        sendError instanceof Error ? sendError.message : "Не удалось отправить PDF",
      );
    } finally {
      setPdfPending(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Быстрые действия"
        aria-expanded={open}
        title="Быстрые действия"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--finance-border)] text-[#64748B] hover:bg-[var(--finance-hover)]"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-30 mb-1 w-52 overflow-hidden rounded-xl border border-[var(--finance-border)] bg-white py-1 shadow-[var(--finance-shadow)]"
        >
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              role="menuitem"
              className="block px-3 py-2 text-sm text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
              onClick={(e) => e.stopPropagation()}
            >
              {action.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={pdfPending}
            className="block w-full px-3 py-2 text-left text-sm text-[var(--finance-text)] hover:bg-[var(--finance-hover)] disabled:opacity-60"
            onClick={sendPdf}
          >
            {pdfPending ? "Формирование PDF…" : "Отправить PDF"}
          </button>
          {pdfError ? (
            <p className="border-t border-[var(--finance-border)] px-3 py-2 text-[11px] text-red-600">
              {pdfError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="finance-card flex min-h-[88px] flex-col p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-bold leading-none tabular-nums tracking-tight text-[#0F172A]">
        {value}
      </p>
      <p className="mt-auto pt-1.5 text-[11px] text-[#94A3B8]">{hint}</p>
    </div>
  );
}

function matchesSearch(property: PropertyDTO, query: string) {
  if (!query) return true;
  const hay = [
    property.name,
    property.address,
    property.city,
    property.district,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export function PropertyList({ properties }: { properties: PropertyListItem[] }) {
  const router = useRouter();
  const view = useSyncExternalStore(subscribeViewMode, readViewMode, () => "cards");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [management, setManagement] = useState<string>("ALL");
  const [city, setCity] = useState<string>("ALL");

  function changeView(next: ViewMode) {
    writeViewMode(next);
  }

  const cities = useMemo(() => {
    const set = new Set(properties.map((p) => p.city).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (!matchesSearch(p, q)) return false;
      if (status !== "ALL" && p.status !== status) return false;
      if (type !== "ALL" && p.type !== type) return false;
      if (management !== "ALL" && p.managementType !== management) return false;
      if (city !== "ALL" && p.city !== city) return false;
      return true;
    });
  }, [properties, search, status, type, management, city]);

  const kpi = useMemo(() => {
    const total = properties.length;
    const active = properties.filter((p) => p.status === "ACTIVE").length;
    const own = properties.filter((p) => p.managementType === "OWN").length;
    const commission = properties.filter(
      (p) => p.managementType === "COMMISSION",
    ).length;
    const longTerm = properties.filter((p) => p.directions.longTermListingId)
      .length;
    const sales = properties.filter((p) => p.directions.saleListingId).length;
    return { total, active, own, commission, longTerm, sales };
  }, [properties]);

  if (properties.length === 0) {
    return (
      <div className="finance-card px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--finance-blue-light)] text-[var(--finance-blue)]">
          <IconBuilding size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--finance-text)]">
          Нет объектов
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--finance-text-secondary)]">
          Добавьте первый объект, чтобы начать работу с бронированиями.
        </p>
        <Link
          href="/crm/properties/new"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <IconPlus size={16} />
          Добавить объект
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Всего"
          value={String(kpi.total)}
          hint="в базе"
          icon={<IconBuilding size={16} />}
          iconBg="bg-[var(--finance-blue-light)]"
          iconColor="text-[var(--finance-blue)]"
        />
        <KpiCard
          label="Активные"
          value={String(kpi.active)}
          hint={propertyStatusLabels.ACTIVE.toLowerCase()}
          icon={<IconTag size={16} />}
          iconBg="bg-[var(--finance-green-light)]"
          iconColor="text-[var(--finance-green)]"
        />
        <KpiCard
          label={managementTypeLabels.OWN}
          value={String(kpi.own)}
          hint="собственные"
          icon={<IconWallet size={16} />}
          iconBg="bg-[var(--finance-blue-light)]"
          iconColor="text-[var(--finance-blue)]"
        />
        <KpiCard
          label={managementTypeLabels.COMMISSION}
          value={String(kpi.commission)}
          hint="в управлении"
          icon={<IconWallet size={16} />}
          iconBg="bg-[#F5F3FF]"
          iconColor="text-[#7C3AED]"
        />
        <KpiCard
          label="Долгосрок"
          value={String(kpi.longTerm)}
          hint="с LongTermListing"
          icon={<IconCalendar size={16} />}
          iconBg="bg-[#EFF6FF]"
          iconColor="text-[#2563EB]"
        />
        <KpiCard
          label="Продажа"
          value={String(kpi.sales)}
          hint="с SaleListing"
          icon={<IconTag size={16} />}
          iconBg="bg-[#F5F3FF]"
          iconColor="text-[#7C3AED]"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Поиск объекта</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск объекта..."
              className="w-full rounded-xl border border-[var(--finance-border)] bg-white py-2 pl-3 pr-3 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/15"
            />
          </label>
          <select
            aria-label="Статус"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)]"
          >
            <option value="ALL">Статус</option>
            <option value="ACTIVE">Активен</option>
            <option value="INACTIVE">Неактивен</option>
            <option value="ARCHIVED">В архиве</option>
          </select>
          <select
            aria-label="Тип объекта"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)]"
          >
            <option value="ALL">Тип</option>
            <option value="APARTMENT">Квартира</option>
            <option value="HOUSE">Дом</option>
            <option value="STUDIO">Студия</option>
            <option value="OTHER">Другое</option>
          </select>
          <select
            aria-label="Управление"
            value={management}
            onChange={(e) => setManagement(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)]"
          >
            <option value="ALL">Управление</option>
            <option value="OWN">Собственный</option>
            <option value="COMMISSION">Комиссия</option>
          </select>
          {cities.length > 1 ? (
            <select
              aria-label="Город"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)]"
            >
              <option value="ALL">Город</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div
          className="inline-flex rounded-xl border border-[var(--finance-border)] bg-white p-0.5"
          role="group"
          aria-label="Вид списка"
        >
          <button
            type="button"
            onClick={() => changeView("cards")}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${
              view === "cards"
                ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                : "text-[#64748B] hover:bg-[var(--finance-hover)]"
            }`}
          >
            Карточки
          </button>
          <button
            type="button"
            onClick={() => changeView("table")}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${
              view === "table"
                ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                : "text-[#64748B] hover:bg-[var(--finance-hover)]"
            }`}
          >
            Таблица
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--finance-text-muted)]">
        Показано {filtered.length} из {properties.length}
      </p>

      {filtered.length === 0 ? (
        <div className="finance-card px-6 py-10 text-center text-sm text-[var(--finance-text-secondary)]">
          Нет объектов по выбранным фильтрам
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="finance-card flex flex-col transition hover:border-[#CFD9E8]"
            >
              <Link
                href={`/crm/properties/${item.id}`}
                className="block aspect-[16/10] overflow-hidden bg-[#EEF3F9]"
              >
                <CoverThumb property={item} />
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <Link
                    href={`/crm/properties/${item.id}`}
                    className="text-base font-semibold text-[var(--finance-text)] hover:text-[var(--finance-blue)]"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--finance-text-secondary)]">
                    {item.city}
                    {item.district ? ` · ${item.district}` : ""}
                    {item.address ? ` · ${item.address}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--finance-text-muted)]">
                    {propertyTypeLabels[item.type]} · {item.rooms} комн. ·{" "}
                    {item.guests} гост.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={item.status} />
                  <ManagementBadge type={item.managementType} />
                </div>
                <DirectionChips item={item} />
                <div className="mt-auto space-y-2 pt-1">
                  <PropertyPresentationActions
                    propertyId={item.id}
                    propertyName={item.name}
                    compact
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/crm/properties/${item.id}`}
                      className="inline-flex rounded-xl border border-[var(--finance-border)] px-3 py-1.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
                    >
                      Открыть
                    </Link>
                    <QuickActionsMenu item={item} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="finance-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--finance-border)] text-[11px] uppercase tracking-wide text-[#94A3B8]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Фото</th>
                  <th className="px-3 py-2.5 font-medium">Объект</th>
                  <th className="px-3 py-2.5 font-medium">Адрес</th>
                  <th className="px-3 py-2.5 font-medium">Тип</th>
                  <th className="px-3 py-2.5 font-medium">Управление</th>
                  <th className="px-3 py-2.5 font-medium">Статус</th>
                  <th className="px-3 py-2.5 font-medium">Посуточно</th>
                  <th className="px-3 py-2.5 font-medium">Долгосрок</th>
                  <th className="px-3 py-2.5 font-medium">Продажа</th>
                  <th className="px-3 py-2.5 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[var(--finance-border)] last:border-0 hover:bg-[var(--finance-hover)]"
                    onClick={() => router.push(`/crm/properties/${item.id}`)}
                  >
                    <td className="w-16 min-w-16 px-3 py-2.5">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-[#EEF3F9]">
                        <CoverThumb property={item} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-[var(--finance-text)]">
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                      {item.city}
                      {item.district ? `, ${item.district}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      {propertyTypeLabels[item.type]}
                    </td>
                    <td className="px-3 py-2.5">
                      <ManagementBadge type={item.managementType} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <YesNo value />
                    </td>
                    <td className="px-3 py-2.5">
                      <YesNo value={Boolean(item.directions.longTermListingId)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <YesNo value={Boolean(item.directions.saleListingId)} />
                    </td>
                    <td
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/crm/properties/${item.id}`}
                          className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium hover:bg-white"
                        >
                          Открыть
                        </Link>
                        <QuickActionsMenu item={item} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
