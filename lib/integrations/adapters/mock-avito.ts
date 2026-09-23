import type {
  ExternalBookingRecord,
  ExternalListing,
  OccupancyInterval,
  SalesChannelAdapter,
} from "@/lib/integrations/types";

const mockListings: ExternalListing[] = [
  {
    id: "111111111",
    title: "Тестовая квартира на Авито",
    status: "active",
    url: "https://www.avito.ru/test/111111111",
    imageUrl: null,
    price: 3500,
  },
  {
    id: "222222222",
    title: "Тестовая студия на Авито",
    status: "active",
    url: "https://www.avito.ru/test/222222222",
    imageUrl: null,
    price: 2800,
  },
];

const mockBookings: ExternalBookingRecord[] = [
  {
    externalId: "777",
    listingId: "111111111",
    checkIn: "2026-11-10",
    checkOut: "2026-11-14",
    guestsCount: 2,
    totalAmount: 14000,
    status: "active",
    guest: {
      externalId: "avito-guest-1",
      name: "Иван Иванов",
      phone: "9991234567",
      email: "ivan.avito@test.local",
    },
    raw: { avito_booking_id: 777, status: "active" },
  },
];

export class MockAvitoAdapter implements SalesChannelAdapter {
  readonly code = "AVITO" as const;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "SYNCING" | "ERROR" = "DISCONNECTED";
  accountId: string | null = null;
  lastError: string | null = null;
  listings = mockListings.map((listing) => ({ ...listing }));
  bookings = mockBookings.map((booking) => ({
    ...booking,
    guest: { ...booking.guest },
  }));
  pushedAvailability: Array<{ listingId: string; intervals: OccupancyInterval[] }> = [];
  failConnect = false;
  httpFailures: number[] = [];

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MockAvitoAdapter нельзя использовать в production");
    }
  }

  async connect() {
    this.status = "CONNECTING";

    if (this.failConnect) {
      this.status = "ERROR";
      this.lastError = "Не удалось подключить Авито";
      throw new Error(this.lastError);
    }

    this.status = "CONNECTED";
    this.accountId = "mock-avito-account";
    this.lastError = null;
    return { status: this.status, accountId: this.accountId };
  }

  async disconnect() {
    this.status = "DISCONNECTED";
    this.accountId = null;
  }

  async getConnectionStatus() {
    return {
      status: this.status,
      accountId: this.accountId,
      lastError: this.lastError,
    };
  }

  async getListings() {
    return this.listings;
  }

  async getListing(id: string) {
    return this.listings.find((listing) => listing.id === id) ?? null;
  }

  async getBookings(input: { listingId: string; dateStart: string; dateEnd: string }) {
    return this.bookings.filter((booking) => booking.listingId === input.listingId);
  }

  async pushAvailability(input: { listingId: string; intervals: OccupancyInterval[] }) {
    this.pushedAvailability.push(input);
  }

  async pushPrices() {
    return;
  }
}
