import test from "node:test";
import assert from "node:assert/strict";
import {
  applyResult,
  applySnapshot,
  applyStatus,
  applyStep,
  createInitialRunState
} from "../src/state/runState.js";

test("createInitialRunState seeds defaults", () => {
  const state = createInitialRunState();
  assert.equal(state.status, "idle");
  assert.equal(state.step, "");
  assert.equal(state.runId, null);
  assert.equal(state.tone, "neutral");
  assert.equal(state.format, "blog");
  assert.deepEqual(state.research, []);
});

test("applySnapshot maps id to runId", () => {
  const state = createInitialRunState();
  const next = applySnapshot(state, { id: "run-1", status: "running" });
  assert.equal(next.runId, "run-1");
  assert.equal(next.status, "running");
});

test("applyStep updates the step", () => {
  const state = createInitialRunState();
  const next = applyStep(state, "researcher:done");
  assert.equal(next.step, "researcher:done");
});

test("applyStatus updates status and error", () => {
  const state = createInitialRunState();
  const next = applyStatus(state, "error", "Boom");
  assert.equal(next.status, "error");
  assert.equal(next.error, "Boom");
});

test("applyResult finalizes draft and research", () => {
  const state = createInitialRunState();
  const next = applyResult(state, {
    draft: "Hello",
    research: [{ title: "A", url: "x", snippet: "y" }]
  });
  assert.equal(next.status, "complete");
  assert.equal(next.step, "complete");
  assert.equal(next.draft, "Hello");
  assert.equal(next.research.length, 1);
});
