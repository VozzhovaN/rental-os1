import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET as getHealth } from "@/app/api/health/route";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import {
  createChannelListingSchema,
  updateChannelListingSchema,
} from "@/lib/validations/channel-listing";

const env = process.env as Record<string, string | undefined>;

describe("production hardening (stage 13)", () => {
  const NODE_ENV = env.NODE_ENV;
  const APP_ORIGIN = env.APP_ORIGIN;

  afterEach(() => {
    if (NODE_ENV === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = NODE_ENV;
    if (APP_ORIGIN === undefined) delete env.APP_ORIGIN;
    else env.APP_ORIGIN = APP_ORIGIN;
  });

  it("CSRF check fails closed in production when APP_ORIGIN is missing", () => {
    env.NODE_ENV = "production";
    delete env.APP_ORIGIN;
    assert.throws(() =>
      assertTrustedOrigin(
        new Request("https://crm.example.com/api/x", {
          method: "POST",
          headers: { origin: "https://evil.example", host: "crm.example.com" },
        }),
      ),
    );
  });

  it("decryptSecret rejects unprefixed (unencrypted) values in production", () => {
    env.NODE_ENV = "production";
    assert.equal(decryptSecret("plaintext-legacy-token"), null);
    // Real ciphertext still decrypts.
    const cipher = encryptSecret("real-token");
    assert.equal(decryptSecret(cipher), "real-token");
  });

  it("channel listing schemas reject unknown fields (mass assignment)", () => {
    const created = createChannelListingSchema.safeParse({
      salesChannelId: "ch",
      externalId: "id",
      injected: "x",
    });
    assert.equal(created.success, false);

    const updated = updateChannelListingSchema.safeParse({
      externalId: "id",
      injected: "x",
    });
    assert.equal(updated.success, false);
  });

  it("health endpoint returns minimal status with no sensitive details", async () => {
    const response = await getHealth();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(body, { status: "ok" });
  });
});
