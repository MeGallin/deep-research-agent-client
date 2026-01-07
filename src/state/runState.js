export function createInitialRunState(overrides = {}) {
  return {
    status: "idle",
    step: "",
    runId: null,
    tone: "neutral",
    format: "blog",
    guidance: "",
    tokensTotal: 0,
    draft: "",
    research: [],
    error: null,
    ...overrides
  };
}

export function applySnapshot(prev, snapshot) {
  if (!snapshot) {
    return prev;
  }
  const next = { ...prev, ...snapshot };
  if (snapshot.id && !snapshot.runId) {
    next.runId = snapshot.id;
  }
  if (!snapshot.tone && prev?.tone) {
    next.tone = prev.tone;
  }
  if (!snapshot.format && prev?.format) {
    next.format = prev.format;
  }
  if (typeof snapshot.guidance === "string") {
    next.guidance = snapshot.guidance;
  }
  if (typeof snapshot.tokensTotal === "number") {
    next.tokensTotal = snapshot.tokensTotal;
  }
  return next;
}

export function applyStep(prev, step) {
  return {
    ...prev,
    step: step || prev.step
  };
}

export function applyStatus(prev, status, error) {
  return {
    ...prev,
    status: status || prev.status,
    error: error ? error : null
  };
}

export function applyResult(prev, result) {
  return {
    ...prev,
    status: "complete",
    step: "complete",
    draft: result?.draft || "",
    research: result?.research || [],
    tokensTotal: typeof result?.tokensTotal === "number" ? result.tokensTotal : prev.tokensTotal
  };
}
