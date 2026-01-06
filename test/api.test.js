import test from "node:test";
import assert from "node:assert/strict";
import { createRun, listRuns } from "../src/api.js";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test("createRun posts a topic and tone", async () => {
  global.fetch = async (url, options) => {
    assert.ok(String(url).includes("/runs"));
    assert.equal(options.method, "POST");
    const payload = JSON.parse(options.body);
    assert.equal(payload.topic, "Test topic");
    assert.equal(payload.tone, "analytical");
    return {
      ok: true,
      json: async () => ({ runId: "run-123" })
    };
  };

  const result = await createRun("Test topic", "analytical");
  assert.equal(result.runId, "run-123");
});

test("listRuns builds query params", async () => {
  let capturedUrl = "";
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok: true,
      json: async () => ({ total: 0, items: [] })
    };
  };

  await listRuns({ status: "complete", limit: 10, offset: 20 });

  assert.ok(capturedUrl.includes("status=complete"));
  assert.ok(capturedUrl.includes("limit=10"));
  assert.ok(capturedUrl.includes("offset=20"));
});
