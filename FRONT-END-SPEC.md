# FRONT-END-SPEC.md

## 1. Purpose

Provide a ReactJS front-end to:

1. Submit a **topic** to generate a blog post using a **multi-agent workflow** (Researcher → Writer).
2. Display **live progress** using **Server-Sent Events (SSE)**.
3. Render final outputs: **draft** + **sources**.
4. Browse and open **historical runs** (persisted by the backend in SQLite for POC).

Back-end prompts are configuration-driven; the front-end treats prompt content as opaque and only consumes results.

---

## 2. Primary Workflow (Step-by-step)

### 2.1 Generate a blog post

1. User navigates to **Builder** screen.
2. User enters a **topic**.
3. User clicks **Generate**.
4. Front-end calls: `POST /api/runs` with `{ topic }`.
5. API responds `202 Accepted` with `{ runId }`.
6. Front-end opens an SSE stream: `GET /api/runs/:runId/events`.
7. Front-end updates UI as SSE events arrive (snapshot → step/status updates → result).
8. On `result` event, render **draft** and **sources**, then close the SSE connection.
9. User may copy the draft and open source links.

### 2.2 Browse historical runs

1. User navigates to **Runs** screen.
2. Front-end calls `GET /api/runs?status=&limit=&offset=` to retrieve paginated run summaries.
3. User optionally filters by status and pages through results.
4. User selects a run row.
5. Front-end navigates to **Run Detail** screen.
6. Front-end calls `GET /api/runs/:runId` to load a snapshot.
7. If the run is still `queued` or `running`, front-end also opens SSE to continue live updates.

---

## 3. Screens and Component Responsibilities

### 3.1 App Shell

- Navigation: **Builder**, **Runs**
- Routing can be:
  - Minimal (component state), or
  - React Router (optional for POC)

### 3.2 Builder Screen

**Inputs**
- `topic` (string)

**Outputs**
- `status` (idle|queued|running|complete|error)
- `step` (string)
- `draft` (string)
- `research` (array of `{ title, url, snippet }`)
- `error` (string|null)

**Components**
- `TopicInput` (validation min 3, max 200)
- `GenerateButton` (disabled while run in progress)
- `StatusPanel` (status + step + runId)
- `DraftPanel` (draft preview, copy-to-clipboard)
- `SourcesPanel` (list with link-out)

### 3.3 Runs List Screen

**Inputs**
- `status` filter: All | queued | running | complete | error
- `limit` page size: 10/25/50/100
- `offset` (pagination)

**Outputs**
- `items` (run summaries)
- `total` count

**Components**
- `FiltersBar` (status, page size)
- `RunsTable` (rows clickable)
- `PaginationControls` (prev/next)

### 3.4 Run Detail Screen

**Inputs**
- `runId`

**Outputs**
- full run snapshot: `topic`, `status`, `step`, `draft`, `research`, `error`, timestamps

**Components**
- `BackButton`
- `RunHeader`
- `DraftPanel`
- `SourcesPanel`
- `ErrorBanner`

---

## 4. API Contract (Front-end)

Base URL: `VITE_API_BASE` (default `http://localhost:3001/api`)

### 4.1 Create a run

- **POST** `/runs`
- Request body:
  ```json
  { "topic": "..." }
  ```
- Response:
  - `202`:
    ```json
    { "runId": "..." }
    ```

### 4.2 Get run snapshot

- **GET** `/runs/:runId`
- Response `200`:
  ```json
  {
    "id": "...",
    "topic": "...",
    "status": "queued|running|complete|error",
    "step": "...",
    "research": [{ "title": "...", "url": "...", "snippet": "..." }],
    "draft": "...",
    "error": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```

### 4.3 List runs

- **GET** `/runs?status=&limit=&offset=`
- Response `200`:
  ```json
  {
    "total": 123,
    "limit": 25,
    "offset": 0,
    "items": [
      {
        "id": "...",
        "topic": "...",
        "status": "complete",
        "step": "complete",
        "error": null,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
  ```

### 4.4 SSE stream

- **GET** `/runs/:runId/events` (SSE)

Event types:
- `snapshot`: full run snapshot
- `status`: `{ status, error? }`
- `step`: `{ step, ... }`
- `result`: `{ topic, research, draft }`

Client event handling rules:
- On `snapshot`: replace local run state.
- On `step`: update progress indicator.
- On `status`: update status and show error if present.
- On `result`: update `draft` + `research`, set status complete, close SSE.

---

## 5. Validation and UX Rules

- Trim topic whitespace.
- Topic length: **3–200** characters.
- Disable Generate while a run is in progress.
- Always show `runId` (POC observability).
- Open external source links in a new tab with `rel="noreferrer"`.

---

## 6. Pseudocode (Front-end)

### 6.1 Builder flow pseudocode (SSE)

```pseudo
FUNCTION onGenerateClicked(topicText):
  topic = trim(topicText)
  IF topic invalid THEN
    showValidationError()
    RETURN

  setUI(
    status="running",
    step="",
    draft="",
    research=[],
    error=null,
    runId=null
  )

  response = HTTP_POST("/api/runs", { topic })
  runId = response.runId
  setUI(runId=runId)

  es = NEW EventSource("/api/runs/" + runId + "/events")

  es.on("snapshot", (run) => {
    setUIFromRun(run)
  })

  es.on("step", (payload) => {
    setUI(step = payload.step)
  })

  es.on("status", (payload) => {
    setUI(status = payload.status)
    IF payload.error EXISTS:
      setUI(error = payload.error)
  })

  es.on("result", (payload) => {
    setUI(
      status="complete",
      step="complete",
      draft=payload.draft,
      research=payload.research
    )
    es.close()
  })

  es.onerror = () => {
    showNonBlockingConnectionWarning()

    // Optional fallback:
    // poll GET /api/runs/:runId every 3–5 seconds until complete/error
  }
END FUNCTION
```

### 6.2 Runs list pseudocode

```pseudo
FUNCTION loadRuns(statusFilter, limit, offset):
  qs = buildQueryString(status=statusFilter, limit=limit, offset=offset)
  page = HTTP_GET("/api/runs?" + qs)
  setUI(total=page.total, items=page.items)
END FUNCTION

FUNCTION onRunRowClick(runId):
  navigateToRunDetail(runId)
END FUNCTION
```

### 6.3 Run detail pseudocode

```pseudo
FUNCTION openRunDetail(runId):
  run = HTTP_GET("/api/runs/" + runId)
  setUI(run=run)

  IF run.status IN ["queued", "running"]:
    es = NEW EventSource("/api/runs/" + runId + "/events")
    es.on("snapshot", replaceRun)
    es.on("step", updateRunStep)
    es.on("status", updateRunStatusAndError)
    es.on("result", mergeFinalResultAndClose)
END FUNCTION
```

---

## 7. Acceptance Criteria

Builder:
- POST creates a run and returns a `runId`.
- SSE updates steps and returns final draft + sources.
- Errors display clearly.

Runs:
- Runs list paginates and filters.
- Run detail renders persisted content and continues streaming if run is active.
