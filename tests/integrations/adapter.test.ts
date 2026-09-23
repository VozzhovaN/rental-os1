import "../helpers/env";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAvitoAdapter,
  getMockAvitoAdapter,
  isMockAvito,
  resetMockAvitoAdapter,
} from "@/lib/integrations/adapters";
import { MockAvitoAdapter } from "@/lib/integrations/adapters/mock-avito";
import { serializeConnectionPublic } from "@/lib/integrations/connections";

describe("MockAvitoAdapter", () => {
  it("переводит DISCONNECTED → CONNECTING → CONNECTED", async () => {
    const adapter = new MockAvitoAdapter();
    assert.equal(adapter.status, "DISCONNECTED");
    const result = await adapter.connect();
    assert.equal(result.status, "CONNECTED");
    assert.equal(adapter.status, "CONNECTED");
  });

  it("переводит CONNECTING → ERROR при сбое", async () => {
    const adapter = new MockAvitoAdapter();
    adapter.failConnect = true;
    await assert.rejects(() => adapter.connect());
    assert.equal(adapter.status, "ERROR");
  });

  it("возвращает список объявлений", async () => {
    const adapter = new MockAvitoAdapter();
    const listings = await adapter.getListings();
    assert.ok(listings.length >= 1);
    assert.equal(listings[0].id, "111111111");
  });

  it("запрещён в production даже при AVITO_ADAPTER=mock", () => {
    const env = process.env as unknown as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousAdapter = env.AVITO_ADAPTER;

    try {
      env.NODE_ENV = "production";
      env.AVITO_ADAPTER = "mock";
      assert.equal(isMockAvito(), false);
      assert.throws(() => getAvitoAdapter(), /запрещён в production/);
      assert.throws(() => getMockAvitoAdapter(), /нельзя использовать в production/);
      assert.throws(() => resetMockAvitoAdapter(), /нельзя использовать в production/);
      assert.throws(() => new MockAvitoAdapter(), /нельзя использовать в production/);
      assert.equal(
        serializeConnectionPublic({
          status: "CONNECTED",
          providerAccountId: "acc",
          accessToken: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastError: null,
        }).connected,
        false,
      );
    } finally {
      env.NODE_ENV = previousNodeEnv;
      env.AVITO_ADAPTER = previousAdapter;
    }
  });
});
