export function createInitialRunState(overrides = {}) {
  return {
    status: "idle",
    step: "",
    runId: null,
    tone: "neutral",
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
    research: result?.research || []
  };
}
