import { AvitoAdapter } from "@/lib/integrations/adapters/avito";
import { MockAvitoAdapter } from "@/lib/integrations/adapters/mock-avito";
import {
  assertMockAvitoAllowed,
  isMockAvito,
  isProductionEnv,
} from "@/lib/integrations/mock-guard";
import type { SalesChannelAdapter } from "@/lib/integrations/types";

export { assertMockAvitoAllowed, isMockAvito, isProductionEnv };

let mockSingleton: MockAvitoAdapter | null = null;

export function getAvitoAdapter(): SalesChannelAdapter {
  if (isProductionEnv() && process.env.AVITO_ADAPTER === "mock") {
    throw new Error("AVITO_ADAPTER=mock запрещён в production");
  }

  if (isMockAvito()) {
    mockSingleton ??= new MockAvitoAdapter();
    return mockSingleton;
  }

  return new AvitoAdapter();
}

export function getMockAvitoAdapter() {
  assertMockAvitoAllowed();
  mockSingleton ??= new MockAvitoAdapter();
  return mockSingleton;
}

export function resetMockAvitoAdapter() {
  assertMockAvitoAllowed();
  mockSingleton = new MockAvitoAdapter();
  return mockSingleton;
}
