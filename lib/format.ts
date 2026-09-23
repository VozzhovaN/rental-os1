export function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toDateInputValue(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(value: Date | string, days: number) {
  const date = typeof value === "string" ? new Date(value) : new Date(value.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function startOfUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function startOfNextUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1));
}

export function startOfUtcDay(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function nightsBetween(checkIn: Date | string, checkOut: Date | string) {
  const start = startOfUtcDay(checkIn).getTime();
  const end = startOfUtcDay(checkOut).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function utcDaysInMonth(year: number, month: number) {
  const start = startOfUtcMonth(year, month);
  const end = startOfNextUtcMonth(year, month);
  const days: Date[] = [];

  for (let cursor = start; cursor < end; cursor = addUtcDays(cursor, 1)) {
    days.push(cursor);
  }

  return days;
}

export function formatWeekdayShort(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(startOfUtcMonth(year, month));
}

export function formatNights(nights: number) {
  const abs = Math.abs(nights);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${nights} ночей`;
  }

  if (mod10 === 1) {
    return `${nights} ночь`;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return `${nights} ночи`;
  }

  return `${nights} ночей`;
}

export function formatGuestsCount(count: number) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} гостей`;
  }

  if (mod10 === 1) {
    return `${count} гость`;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} гостя`;
  }

  return `${count} гостей`;
}

/** Занят день checkIn включительно, checkOut исключительно. */
export function occupiesUtcDay(
  checkIn: Date | string,
  checkOut: Date | string,
  day: Date | string,
) {
  const start = startOfUtcDay(checkIn).getTime();
  const end = startOfUtcDay(checkOut).getTime();
  const current = startOfUtcDay(day).getTime();
  return current >= start && current < end;
}

export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatGuestName(guest: {
  firstName: string;
  lastName: string | null;
  middleName?: string | null;
}) {
  return [guest.lastName, guest.firstName, guest.middleName].filter(Boolean).join(" ");
}
