import test from "node:test";
import assert from "node:assert/strict";
import { createRewrite, createRun, getRewrite, listRewrites, listRuns } from "../src/api.js";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test("createRun posts a topic, tone, and format", async () => {
  global.fetch = async (url, options) => {
    assert.ok(String(url).includes("/runs"));
    assert.equal(options.method, "POST");
    const payload = JSON.parse(options.body);
    assert.equal(payload.topic, "Test topic");
    assert.equal(payload.tone, "analytical");
    assert.equal(payload.format, "email");
    return {
      ok: true,
      json: async () => ({ runId: "run-123" })
    };
  };

  const result = await createRun("Test topic", "analytical", "email");
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

test("listRewrites requests rewrites list", async () => {
  let capturedUrl = "";
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return { ok: true, json: async () => ({ items: [] }) };
  };

  const response = await listRewrites("run-5");
  assert.equal(Array.isArray(response.items), true);
  assert.ok(capturedUrl.includes("/runs/run-5/rewrites"));
});

test("getRewrite requests a specific rewrite", async () => {
  let capturedUrl = "";
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return { ok: true, json: async () => ({ id: "var-1" }) };
  };

  const response = await getRewrite("run-5", "var-1");
  assert.equal(response.id, "var-1");
  assert.ok(capturedUrl.includes("/runs/run-5/rewrites/var-1"));
});

test("createRewrite posts tone and format", async () => {
  global.fetch = async (url, options) => {
    assert.ok(String(url).includes("/runs/run-5/rewrites"));
    assert.equal(options.method, "POST");
    const payload = JSON.parse(options.body);
    assert.equal(payload.tone, "optimistic");
    assert.equal(payload.format, "memo");
    return { ok: true, json: async () => ({ id: "var-2" }) };
  };

  const response = await createRewrite("run-5", {
    tone: "optimistic",
    format: "memo"
  });
  assert.equal(response.id, "var-2");
});

test("deleteRun issues a DELETE request", async () => {
  let method = "";
  global.fetch = async (url, options) => {
    method = options.method;
    assert.ok(String(url).includes("/runs/run-9"));
    return { ok: true, json: async () => ({}) };
  };

  const { deleteRun } = await import("../src/api.js");
  await deleteRun("run-9");
  assert.equal(method, "DELETE");
});
