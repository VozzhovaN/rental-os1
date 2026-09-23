import type { GuestListItemDTO } from "@/lib/guests";

export function buildGuestListKpi(guests: GuestListItemDTO[]) {
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    total: guests.length,
    active: guests.filter((g) => g.uiStatus === "STAYING").length,
    neu: guests.filter((g) => new Date(g.createdAt).getTime() >= monthAgo)
      .length,
    repeat: guests.filter((g) => g.isRepeat).length,
  };
}
