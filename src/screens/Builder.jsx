import { useEffect, useRef, useState } from "react";
import { createEventSource, createRun, getRun } from "../api.js";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Panel from "../components/Panel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const initialRunState = {
  status: "idle",
  step: "",
  runId: null,
  draft: "",
  research: [],
  error: null
};

export default function Builder() {
  const [topic, setTopic] = useState("");
  const [validationError, setValidationError] = useState("");
  const [run, setRun] = useState(initialRunState);
  const [streamWarning, setStreamWarning] = useState("");
  const eventSourceRef = useRef(null);

  const isBusy = run.status === "queued" || run.status === "running";

  const attachStream = (runId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = createEventSource(runId);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => ({
        ...prev,
        ...data
      }));
    });

    es.addEventListener("step", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => ({
        ...prev,
        step: data.step || prev.step
      }));
    });

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => ({
        ...prev,
        status: data.status || prev.status,
        error: data.error || null
      }));
    });

    es.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => ({
        ...prev,
        status: "complete",
        step: "complete",
        draft: data.draft || "",
        research: data.research || []
      }));
      es.close();
    });

    es.onerror = async () => {
      setStreamWarning("Live connection interrupted. Results will keep updating.");
      if (!runId) {
        return;
      }
      try {
        const snapshot = await getRun(runId);
        setRun((prev) => ({ ...prev, ...snapshot }));
      } catch (error) {
        // Ignore snapshot errors; user can retry.
      }
    };
  };

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      setValidationError("Topic must be 3-200 characters.");
      return;
    }

    setValidationError("");
    setRun({
      status: "queued",
      step: "starting",
      runId: null,
      draft: "",
      research: [],
      error: null
    });

    try {
      const response = await createRun(trimmed);
      setRun((prev) => ({
        ...prev,
        status: "running",
        runId: response.runId
      }));
      attachStream(response.runId);
    } catch (error) {
      setRun((prev) => ({
        ...prev,
        status: "error",
        error: error.message || "Failed to start run."
      }));
    }
  };

  const handleReset = () => {
    setTopic("");
    setValidationError("");
    setRun(initialRunState);
    setStreamWarning("");
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="builder">
      <header className="builder-header">
        <div>
          <p className="eyebrow">Builder</p>
          <h1>AI Research Agent</h1>
          <p className="subhead">
            Submit a topic to run the researcher and writer pipeline. Live steps
            and results appear here once the stream is wired.
          </p>
        </div>
        <div className="builder-actions">
          <Button onClick={handleGenerate} disabled={isBusy}>
            {isBusy ? "Generating..." : "Generate"}
          </Button>
          <Button variant="secondary" onClick={handleReset} disabled={isBusy}>
            Reset
          </Button>
        </div>
      </header>

      <div className="builder-grid">
        <Panel title="Topic">
          <Input
            label="Blog topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g., The future of autonomous logistics"
          />
          {validationError ? (
            <p className="field-error">{validationError}</p>
          ) : null}
        </Panel>

        <Panel title="Run Status">
          <div className="status-row">
            <StatusBadge status={run.status} />
            {run.runId ? (
              <span className="muted">Run ID: {run.runId}</span>
            ) : (
              <span className="muted">No run started</span>
            )}
          </div>
          <div className="status-meta">
            <div>
              <span className="muted">Step</span>
              <div className="status-value">{run.step || "-"}</div>
            </div>
            <div>
              <span className="muted">Status</span>
              <div className="status-value">{run.status}</div>
            </div>
          </div>
          {streamWarning ? (
            <p className="warning-banner">{streamWarning}</p>
          ) : null}
          {run.error ? <p className="error-banner">{run.error}</p> : null}
        </Panel>
      </div>

      <div className="builder-output">
        <Panel title="Draft">
          {run.draft ? (
            <pre className="draft-text">{run.draft}</pre>
          ) : (
            <p className="muted">Draft output will appear here.</p>
          )}
        </Panel>
        <Panel title="Sources">
          {run.research.length ? (
            <ol className="sources-list">
              {run.research.map((item) => (
                <li key={item.url}>
                  <strong>{item.title}</strong>
                  <div className="muted">{item.url}</div>
                  <p className="source-snippet">{item.snippet}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Sources will appear here.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
