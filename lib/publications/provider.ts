import type { LongTermListingDTO } from "@/lib/long-term-listings";
import type { PublicationDTO } from "@/lib/publications";

export type PublicationTransport = "API" | "FEED";

export type PublicationOperation = "PUBLISH" | "UPDATE" | "UNPUBLISH" | "STATUS";

export type ProviderCapability = {
  transport: PublicationTransport;
  canPublish: boolean;
  canUpdate: boolean;
  canUnpublish: boolean;
  canFetchStatus: boolean;
  generateFeed: boolean;
};

export type PublicationPhotoInput = {
  url: string;
  sortOrder: number;
  caption: string | null;
};

export type PublicationCommand = {
  operation: PublicationOperation;
  publication: PublicationDTO;
  listing: LongTermListingDTO;
  photos: PublicationPhotoInput[];
};

export type PublicationCommandResult = {
  ok: boolean;
  externalId?: string | null;
  externalStatus?: string | null;
  error?: {
    code: string;
    message: string;
  };
};

/**
 * Контракт будущего provider layer.
 * Реальных адаптеров на Stage 8.1 нет.
 *
 * Feed-провайдер реализует generateFeed отдельно и не обязан иметь createListing().
 * Serializer читает актуальный LongTermListing и не мутирует его.
 */
export interface LongTermPublicationProvider {
  readonly channelCode: string;
  capabilities(): ProviderCapability;
  execute?(command: PublicationCommand): Promise<PublicationCommandResult>;
  generateFeed?(listings: PublicationCommand[]): string;
}
