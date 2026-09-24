import "./helpers-preload";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDemoResetAllowed,
  demoResetRefusalReason,
  isDemoMode,
} from "@/lib/demo/demo-mode";

describe("demo mode (stage 14)", () => {
  it("isDemoMode is true only for exact 'true'", () => {
    assert.equal(isDemoMode({ DEMO_MODE: "true" }), true);
    assert.equal(isDemoMode({ DEMO_MODE: "TRUE" }), false);
    assert.equal(isDemoMode({ DEMO_MODE: "1" }), false);
    assert.equal(isDemoMode({}), false);
  });

  it("demo reset refuses without DEMO_MODE=true", () => {
    assert.match(
      demoResetRefusalReason({ DEMO_MODE: "false", DATABASE_URL: "file:./demo.db" }) ?? "",
      /DEMO_MODE/,
    );
  });

  it("demo reset refuses the development database", () => {
    assert.match(
      demoResetRefusalReason({ DEMO_MODE: "true", DATABASE_URL: "file:./dev.db" }) ?? "",
      /development database/,
    );
  });

  it("demo reset refuses a non-file (server) database", () => {
    assert.match(
      demoResetRefusalReason({
        DEMO_MODE: "true",
        DATABASE_URL: "postgresql://user:pass@host:5432/prod",
      }) ?? "",
      /SQLite file/,
    );
  });

  it("demo reset refuses a file DB whose name lacks 'demo'", () => {
    assert.match(
      demoResetRefusalReason({ DEMO_MODE: "true", DATABASE_URL: "file:./production.db" }) ?? "",
      /must contain 'demo'/,
    );
  });

  it("demo reset is allowed for a guarded demo database", () => {
    assert.equal(
      demoResetRefusalReason({ DEMO_MODE: "true", DATABASE_URL: "file:./demo.db" }),
      null,
    );
    assert.doesNotThrow(() =>
      assertDemoResetAllowed({ DEMO_MODE: "true", DATABASE_URL: "file:/data/demo.db" }),
    );
    assert.throws(() =>
      assertDemoResetAllowed({ DEMO_MODE: "true", DATABASE_URL: "file:./dev.db" }),
    );
  });
});
