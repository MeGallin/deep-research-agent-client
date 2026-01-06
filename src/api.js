const DEFAULT_BASE = "http://localhost:8000/api";

function getApiBase() {
  return import.meta?.env?.VITE_API_BASE || DEFAULT_BASE;
}

async function handleResponse(response) {
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // Ignore JSON parse errors for non-JSON bodies.
    }
    throw new Error(message);
  }
  return response.json();
}

export async function createRun(topic, tone) {
  const payload = { topic };
  if (tone) {
    payload.tone = tone;
  }
  const response = await fetch(`${getApiBase()}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

export async function getRun(runId) {
  const response = await fetch(`${getApiBase()}/runs/${runId}`);
  return handleResponse(response);
}

export async function listRuns({ status, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }
  const query = params.toString();
  const url = query ? `${getApiBase()}/runs?${query}` : `${getApiBase()}/runs`;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function deleteRun(runId) {
  const response = await fetch(`${getApiBase()}/runs/${runId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    let message = "Failed to delete run";
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore JSON errors
    }
    throw new Error(message);
  }
}

export function createEventSource(runId) {
  return new EventSource(`${getApiBase()}/runs/${runId}/events`);
}
