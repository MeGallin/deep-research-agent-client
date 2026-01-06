import { useEffect, useRef, useState } from "react";
import { createEventSource, getRun } from "../api.js";
import Button from "../components/Button.jsx";
import Panel from "../components/Panel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function RunDetail({ runId, onBack }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [streamWarning, setStreamWarning] = useState("");
  const eventSourceRef = useRef(null);

  const attachStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = createEventSource(id);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (event) => {
      const data = JSON.parse(event.data);
      setRun(data);
    });

    es.addEventListener("step", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => (prev ? { ...prev, step: data.step } : prev));
    });

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) =>
        prev
          ? { ...prev, status: data.status, error: data.error || null }
          : prev
      );
    });

    es.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: "complete",
              step: "complete",
              draft: data.draft,
              research: data.research
            }
          : prev
      );
      es.close();
    });

    es.onerror = async () => {
      setStreamWarning("Live connection interrupted. Refresh to continue.");
      try {
        const snapshot = await getRun(id);
        setRun(snapshot);
      } catch (err) {
        // Ignore snapshot failure.
      }
    };
  };

  useEffect(() => {
    let isMounted = true;
    const loadRun = async () => {
      try {
        const snapshot = await getRun(runId);
        if (!isMounted) {
          return;
        }
        setRun(snapshot);
        if (["queued", "running"].includes(snapshot.status)) {
          attachStream(runId);
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err.message || "Failed to load run.");
      }
    };
    loadRun();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [runId]);

  if (error) {
    return (
      <div className="run-detail">
        <Button variant="secondary" onClick={onBack}>
          Back to runs
        </Button>
        <p className="error-banner">{error}</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="run-detail">
        <Button variant="secondary" onClick={onBack}>
          Back to runs
        </Button>
        <p className="muted">Loading run...</p>
      </div>
    );
  }

  return (
    <div className="run-detail">
      <header className="run-detail-header">
        <Button variant="secondary" onClick={onBack}>
          Back to runs
        </Button>
        <div>
          <p className="eyebrow">Run detail</p>
          <h1>{run.topic}</h1>
          <div className="status-row">
            <StatusBadge status={run.status} />
            <span className="muted">Run ID: {run.id}</span>
          </div>
          <div className="muted">Step: {run.step || "-"}</div>
        </div>
      </header>

      {streamWarning ? <p className="warning-banner">{streamWarning}</p> : null}
      {run.error ? <p className="error-banner">{run.error}</p> : null}

      <div className="builder-output">
        <Panel title="Draft">
          {run.draft ? (
            <pre className="draft-text">{run.draft}</pre>
          ) : (
            <p className="muted">Draft output will appear here.</p>
          )}
        </Panel>
        <Panel title="Sources">
          {run.research?.length ? (
            <ol className="sources-list">
              {run.research.map((item) => (
                <li key={item.url}>
                  <strong>{item.title}</strong>
                  <div className="source-link">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.url}
                    </a>
                  </div>
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
