export type GuestSearchFields = {
  firstName: string;
  lastName: string | null;
  middleName?: string | null;
  phone: string | null;
  email: string | null;
};

export function guestMatchesQuery(guest: GuestSearchFields, query: string) {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return [guest.lastName, guest.firstName, guest.middleName, guest.phone, guest.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function prismaGuestSearchWhere(query: string) {
  const q = query.trim();

  if (!q) {
    return undefined;
  }

  return {
    OR: [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { middleName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ],
  };
}
