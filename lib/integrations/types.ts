export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "SYNCING" | "ERROR";

export type ExternalListing = {
  id: string;
  title: string;
  status: string;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
};

export type ExternalGuest = {
  externalId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type ExternalBookingRecord = {
  externalId: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalAmount: number;
  status: "pending" | "active" | "canceled";
  guest: ExternalGuest;
  raw: unknown;
};

export type OccupancyInterval = {
  dateStart: string;
  dateEnd: string;
  comment?: string;
};

export type SyncBookingsResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
};

export interface SalesChannelAdapter {
  readonly code: string;
  connect(input?: {
    code?: string;
    flow?: "oauth" | "client_credentials";
    state?: string;
  }): Promise<{
    status: ConnectionStatus;
    redirectUrl?: string;
    accountId?: string | null;
  }>;
  disconnect(): Promise<void>;
  getConnectionStatus(): Promise<{
    status: ConnectionStatus;
    accountId: string | null;
    lastError: string | null;
  }>;
  getListings(): Promise<ExternalListing[]>;
  getListing(id: string): Promise<ExternalListing | null>;
  getBookings(input: {
    listingId: string;
    dateStart: string;
    dateEnd: string;
  }): Promise<ExternalBookingRecord[]>;
  pushAvailability(input: {
    listingId: string;
    intervals: OccupancyInterval[];
  }): Promise<void>;
  pushPrices?(input: { listingId: string; prices: unknown }): Promise<void>;
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "NOT_CONNECTED"
      | "AUTH"
      | "RATE_LIMIT"
      | "CONFLICT"
      | "UPSTREAM"
      | "VALIDATION",
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}
