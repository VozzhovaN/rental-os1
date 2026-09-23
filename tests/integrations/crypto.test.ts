import "../helpers/env";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptSecret, encryptSecret, redactSecrets } from "@/lib/integrations/crypto";

describe("integration crypto", () => {
  it("шифрует и расшифровывает секрет", () => {
    const encrypted = encryptSecret("access-token-value");
    assert.ok(encrypted?.startsWith("enc:v1:"));
    assert.equal(decryptSecret(encrypted), "access-token-value");
  });

  it("маскирует токены в строках", () => {
    const redacted = redactSecrets("Bearer abc.def access_token=tok123 client_secret=xyz");
    assert.equal(redacted.includes("abc.def"), false);
    assert.equal(redacted.includes("tok123"), false);
    assert.equal(redacted.includes("xyz"), false);
    assert.equal(redacted.includes("[redacted]"), true);
  });
});
