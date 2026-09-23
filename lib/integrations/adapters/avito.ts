import {
  connectionTokens,
  getAvitoConnection,
  upsertAvitoConnection,
} from "@/lib/integrations/connections";
import { avitoRequest } from "@/lib/integrations/http";
import type {
  ExternalBookingRecord,
  ExternalListing,
  OccupancyInterval,
  SalesChannelAdapter,
} from "@/lib/integrations/types";
import { IntegrationError } from "@/lib/integrations/types";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type ItemsResponse = {
  resources?: Array<{
    id: number;
    title?: string;
    status?: string;
    url?: string;
    price?: number;
  }>;
};

type SelfResponse = {
  id?: number;
  user_id?: number;
};

type RealtyBookingsResponse = {
  bookings?: Array<{
    avito_booking_id?: number;
    check_in?: string;
    check_out?: string;
    guest_count?: number;
    base_price?: number;
    status?: "pending" | "active" | "canceled";
    contact?: { name?: string; phone?: string; email?: string };
  }>;
};

function requireConfig() {
  const clientId = process.env.AVITO_CLIENT_ID?.trim();
  const clientSecret = process.env.AVITO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.AVITO_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret) {
    throw new IntegrationError(
      "Не заданы AVITO_CLIENT_ID и AVITO_CLIENT_SECRET.",
      "NOT_CONFIGURED",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function mapStatus(status?: string): ExternalBookingRecord["status"] {
  if (status === "canceled") {
    return "canceled";
  }

  if (status === "pending") {
    return "pending";
  }

  return "active";
}

export class AvitoAdapter implements SalesChannelAdapter {
  readonly code = "AVITO" as const;

  async connect(input?: { code?: string; flow?: "oauth" | "client_credentials"; state?: string }) {
    const config = requireConfig();

    if (!input?.code && input?.flow !== "client_credentials") {
      if (!config.redirectUri) {
        throw new IntegrationError("Не задан AVITO_REDIRECT_URI.", "NOT_CONFIGURED");
      }

      const scope =
        process.env.AVITO_OAUTH_SCOPE?.trim() || "short_term_rent:read,short_term_rent:write";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope,
      });

      if (input?.state) {
        params.set("state", input.state);
      }

      return {
        status: "CONNECTING" as const,
        redirectUrl: `https://avito.ru/oauth?${params.toString()}`,
      };
    }

    await upsertAvitoConnection({ status: "CONNECTING", lastError: null });

    const tokenForm: Record<string, string> = input?.code
      ? {
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: input.code,
        }
      : {
          grant_type: "client_credentials",
          client_id: config.clientId,
          client_secret: config.clientSecret,
        };

    if (input?.code && config.redirectUri) {
      tokenForm.redirect_uri = config.redirectUri;
    }

    const token = await avitoRequest<TokenResponse>("/token", {
      method: "POST",
      form: tokenForm,
    });

    const expiresAt = new Date(Date.now() + (token.expires_in ?? 86400) * 1000);
    await upsertAvitoConnection({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
    });

    const accountId = await this.readAccountId(token.access_token);
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: accountId,
      lastSuccessAt: new Date(),
      lastError: null,
    });

    return { status: "CONNECTED" as const, accountId };
  }

  async disconnect() {
    await upsertAvitoConnection({
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      providerAccountId: null,
      lastError: null,
    });
  }

  async getConnectionStatus() {
    const connection = await getAvitoConnection();
    return {
      status: connection?.status ?? "DISCONNECTED",
      accountId: connection?.providerAccountId ?? null,
      lastError: connection?.lastError ?? null,
    };
  }

  async getListings(): Promise<ExternalListing[]> {
    const token = await this.ensureToken();
    const listings: ExternalListing[] = [];

    for (let page = 1; page <= 20; page += 1) {
      const payload = await avitoRequest<ItemsResponse>(
        `/core/v1/items?per_page=100&page=${page}`,
        { token, retry401: () => this.refreshToken() },
      );
      const resources = payload.resources ?? [];

      for (const item of resources) {
        listings.push({
          id: String(item.id),
          title: item.title ?? `Объявление ${item.id}`,
          status: item.status ?? "active",
          url: item.url ?? null,
          imageUrl: null,
          price: item.price ?? null,
        });
      }

      if (resources.length < 100) {
        break;
      }
    }

    return listings;
  }

  async getListing(id: string) {
    const listings = await this.getListings();
    return listings.find((listing) => listing.id === id) ?? null;
  }

  async getBookings(input: {
    listingId: string;
    dateStart: string;
    dateEnd: string;
  }): Promise<ExternalBookingRecord[]> {
    const token = await this.ensureToken();
    const userId = await this.requireAccountId();
    const query = new URLSearchParams({
      date_start: input.dateStart,
      date_end: input.dateEnd,
      with_unpaid: "true",
    });
    const payload = await avitoRequest<RealtyBookingsResponse>(
      `/realty/v1/accounts/${userId}/items/${input.listingId}/bookings?${query.toString()}`,
      { token, retry401: () => this.refreshToken() },
    );

    return (payload.bookings ?? [])
      .filter((booking) => booking.avito_booking_id && booking.check_in && booking.check_out)
      .map((booking) => ({
        externalId: String(booking.avito_booking_id),
        listingId: input.listingId,
        checkIn: booking.check_in as string,
        checkOut: booking.check_out as string,
        guestsCount: booking.guest_count ?? 1,
        totalAmount: booking.base_price ?? 0,
        status: mapStatus(booking.status),
        guest: {
          name: booking.contact?.name?.trim() || "Гость Авито",
          phone: booking.contact?.phone ?? null,
          email: booking.contact?.email ?? null,
        },
        raw: booking,
      }));
  }

  async pushAvailability(input: { listingId: string; intervals: OccupancyInterval[] }) {
    const token = await this.ensureToken();
    const userId = await this.requireAccountId();
    await avitoRequest(`/core/v1/accounts/${userId}/items/${input.listingId}/bookings`, {
      method: "POST",
      token,
      retry401: () => this.refreshToken(),
      body: {
        source: "rental-os",
        bookings: input.intervals.map((interval) => ({
          date_start: interval.dateStart,
          date_end: interval.dateEnd,
          type: "booking",
          comment: interval.comment ?? "CRM",
        })),
      },
    });
  }

  async pushPrices() {
    return;
  }

  private async ensureToken() {
    const connection = await getAvitoConnection();

    if (!connection || connection.status === "DISCONNECTED") {
      throw new IntegrationError("Авито не подключено.", "NOT_CONNECTED");
    }

    const tokens = connectionTokens(connection);

    if (
      tokens.accessToken &&
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() - Date.now() > 60_000
    ) {
      return tokens.accessToken;
    }

    const refreshed = await this.refreshToken();

    if (!refreshed) {
      throw new IntegrationError("Сессия Авито истекла. Подключите канал снова.", "AUTH");
    }

    return refreshed;
  }

  private async refreshToken() {
    const connection = await getAvitoConnection();
    const tokens = connection ? connectionTokens(connection) : { accessToken: null, refreshToken: null };
    const config = requireConfig();

    if (tokens.refreshToken) {
      const token = await avitoRequest<TokenResponse>("/token", {
        method: "POST",
        form: {
          grant_type: "refresh_token",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: tokens.refreshToken,
        },
      });
      await upsertAvitoConnection({
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 86400) * 1000),
        status: "CONNECTED",
        lastError: null,
      });
      return token.access_token;
    }

    const token = await avitoRequest<TokenResponse>("/token", {
      method: "POST",
      form: {
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
    await upsertAvitoConnection({
      accessToken: token.access_token,
      refreshToken: null,
      tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 86400) * 1000),
      status: "CONNECTED",
    });
    return token.access_token;
  }

  private async readAccountId(token: string) {
    try {
      const self = await avitoRequest<SelfResponse>("/core/v1/accounts/self", { token });
      return self.id ? String(self.id) : self.user_id ? String(self.user_id) : null;
    } catch {
      return null;
    }
  }

  private async requireAccountId() {
    const connection = await getAvitoConnection();

    if (connection?.providerAccountId) {
      return connection.providerAccountId;
    }

    const fromEnv = process.env.AVITO_USER_ID?.trim();

    if (fromEnv) {
      await upsertAvitoConnection({ providerAccountId: fromEnv });
      return fromEnv;
    }

    const token = await this.ensureToken();
    const accountId = await this.readAccountId(token);

    if (!accountId) {
      throw new IntegrationError("Не удалось определить аккаунт Авито.", "AUTH");
    }

    await upsertAvitoConnection({ providerAccountId: accountId });
    return accountId;
  }
}
