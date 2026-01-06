# Client README

## Overview

This React (Vite) client provides the Builder, Runs list, and Run detail screens for the AI research agent workflow. It consumes the backend `/api` endpoints and listens to SSE for live updates.

## Requirements

- Node.js 18+
- Backend running on `VITE_API_BASE` (default `http://localhost:8000/api`)

## Environment

Create `client/.env` and set:

- `VITE_API_BASE` (default `http://localhost:8000/api`)

## Development

```bash
cd client
npm install
npm run dev
```

## Tests

```bash
cd client
npm test
```

## Notes

- Builder opens SSE at `/api/runs/:runId/events` and listens for `snapshot`, `step`, `status`, and `result`.
- Builder lets you choose a tone before starting a run; the value is sent as `tone` in the API request.
- Runs list and Run detail are read-only views; use Builder to create new runs.
