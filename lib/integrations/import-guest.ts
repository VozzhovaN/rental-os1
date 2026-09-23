import type { Prisma } from "@prisma/client";
import { createGuestHistory } from "@/lib/guest-history";
import type { ExternalGuest } from "@/lib/integrations/types";
import { normalizePhoneDigits } from "@/lib/guests";

type Tx = Prisma.TransactionClient;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "Гость", lastName: null as string | null };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null as string | null };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function formatPhone(phone: string | null | undefined) {
  const digits = normalizePhoneDigits(phone);

  if (!digits) {
    return null;
  }

  return `+7${digits}`;
}

export async function findOrCreateImportedGuest(
  tx: Tx,
  guest: ExternalGuest,
  salesChannelId: string,
) {
  if (guest.externalId) {
    const mapped = await tx.externalBooking.findMany({
      where: { salesChannelId },
      include: { booking: { include: { guest: true } } },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const existingByExternal = mapped.find((row) => {
      const raw = row.rawData as { contact?: { phone?: string }; guest?: { externalId?: string } } | null;
      return raw?.guest?.externalId === guest.externalId;
    });

    if (existingByExternal) {
      return { guest: existingByExternal.booking.guest, created: false };
    }
  }

  if (guest.phone) {
    const needle = normalizePhoneDigits(guest.phone);
    if (needle) {
      const guests = await tx.guest.findMany({ where: { phone: { not: null } } });
      const existing = guests.find((row) => normalizePhoneDigits(row.phone) === needle);
      if (existing) {
        return { guest: existing, created: false };
      }
    }
  }

  if (guest.email) {
    const email = guest.email.trim().toLowerCase();
    const guests = await tx.guest.findMany({ where: { email: { not: null } } });
    const existing = guests.find((row) => row.email?.trim().toLowerCase() === email);
    if (existing) {
      return { guest: existing, created: false };
    }
  }

  const { firstName, lastName } = splitName(guest.name);
  const created = await tx.guest.create({
    data: {
      firstName,
      lastName,
      phone: formatPhone(guest.phone) ?? guest.phone ?? null,
      email: guest.email?.trim() || null,
      comment: "Импортирован из Авито",
    },
  });

  await createGuestHistory(
    {
      guestId: created.id,
      type: "CONTACT",
      title: "Обращение",
      description: "Источник: Авито",
    },
    tx,
  );

  return { guest: created, created: true };
}
