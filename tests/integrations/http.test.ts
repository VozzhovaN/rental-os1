import "../helpers/env";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { avitoRequest, resolveAvitoApiUrl } from "@/lib/integrations/http";
import { IntegrationError } from "@/lib/integrations/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown = { ok: true }, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("avitoRequest", () => {
  it("повторяет запрос один раз после 401", async () => {
    const statuses: number[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const auth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
      if (auth.includes("old")) {
        statuses.push(401);
        return jsonResponse(401, { error: "unauthorized" });
      }
      statuses.push(200);
      return jsonResponse(200, { ok: true });
    }) as typeof fetch;

    const result = await avitoRequest<{ ok: boolean }>("/core/v1/items", {
      token: "old",
      retry401: async () => "new",
    });

    assert.deepEqual(statuses, [401, 200]);
    assert.equal(result.ok, true);
  });

  it("не ретраит 429 бесконечно", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse(429, { error: "rate" }, { "retry-after": "0" });
    }) as typeof fetch;

    await assert.rejects(
      () => avitoRequest("/core/v1/items", { token: "x" }),
      (error: unknown) => error instanceof IntegrationError && error.code === "RATE_LIMIT",
    );
    assert.ok(calls <= 4);
  });

  it("ограничивает повторы 500", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse(500, { error: "server" });
    }) as typeof fetch;

    await assert.rejects(
      () => avitoRequest("/core/v1/items", { token: "x" }),
      (error: unknown) => error instanceof IntegrationError && error.code === "UPSTREAM",
    );
    assert.equal(calls, 3);
  });

  it("SSRF: rejects absolute URLs outside api.avito.ru", () => {
    assert.equal(
      resolveAvitoApiUrl("/core/v1/items"),
      "https://api.avito.ru/core/v1/items",
    );
    assert.equal(
      resolveAvitoApiUrl("https://api.avito.ru/core/v1/items"),
      "https://api.avito.ru/core/v1/items",
    );
    assert.throws(
      () => resolveAvitoApiUrl("https://evil.example/steal"),
      (error: unknown) => error instanceof IntegrationError && error.code === "VALIDATION",
    );
    assert.throws(
      () => resolveAvitoApiUrl("http://127.0.0.1/"),
      (error: unknown) => error instanceof IntegrationError,
    );
  });
});
