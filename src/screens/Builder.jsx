import { useEffect, useRef, useState } from "react";
import { createEventSource, createRun, getRun } from "../api.js";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Panel from "../components/Panel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  applyResult,
  applySnapshot,
  applyStatus,
  applyStep,
  createInitialRunState
} from "../state/runState.js";
import { downloadContent } from "../utils/download.js";

const toneOptions = [
  { value: "neutral", label: "Neutral" },
  { value: "conversational", label: "Conversational" },
  { value: "analytical", label: "Analytical" },
  { value: "persuasive", label: "Persuasive" },
  { value: "optimistic", label: "Optimistic" }
];

const formatOptions = [
  { value: "blog", label: "Blog post" },
  { value: "email", label: "Email" },
  { value: "memo", label: "Memo" },
  { value: "outline", label: "Outline" }
];

const downloadOptions = [
  { value: "md", label: "Markdown (.md)" },
  { value: "txt", label: "Text (.txt)" },
  { value: "html", label: "HTML (.html)" }
];

export default function Builder() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("neutral");
  const [format, setFormat] = useState("blog");
  const [downloadFormat, setDownloadFormat] = useState("md");
  const [validationError, setValidationError] = useState("");
  const [run, setRun] = useState(createInitialRunState);
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
      setRun((prev) => applySnapshot(prev, data));
    });

    es.addEventListener("step", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => applyStep(prev, data.step));
    });

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => applyStatus(prev, data.status, data.error));
    });

    es.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => applyResult(prev, data));
      es.close();
    });

    es.onerror = async () => {
      setStreamWarning("Live connection interrupted. Results will keep updating.");
      if (!runId) {
        return;
      }
      try {
        const snapshot = await getRun(runId);
        setRun((prev) => applySnapshot(prev, snapshot));
      } catch (error) {
        setStreamWarning("Live connection interrupted. Unable to sync snapshot.");
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
    setRun(
      createInitialRunState({
        status: "queued",
        step: "starting",
        tone,
        format
      })
    );
    setStreamWarning("");

    try {
      const response = await createRun(trimmed, tone, format);
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
      setStreamWarning("Unable to start the run. Check the API connection.");
    }
  };

  const handleReset = () => {
    setTopic("");
    setTone("neutral");
    setFormat("blog");
    setDownloadFormat("md");
    setValidationError("");
    setRun(createInitialRunState());
    setStreamWarning("");
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleCopy = async () => {
    if (!run.draft) {
      return;
    }
    try {
      await navigator.clipboard.writeText(run.draft);
      setStreamWarning("Draft copied to clipboard.");
      setTimeout(() => setStreamWarning(""), 2000);
    } catch (error) {
      setStreamWarning("Copy failed. Please copy manually.");
    }
  };

  const handleDownload = () => {
    if (!run.draft) {
      return;
    }
    downloadContent({
      content: run.draft,
      filenameBase: run.topic || topic,
      format: downloadFormat
    });
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
          <label className="field">
            <span className="field-label">Tone</span>
            <select
              className="field-input"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            >
              {toneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Output format</span>
            <select
              className="field-input"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
            <div>
              <span className="muted">Tone</span>
              <div className="status-value">{run.tone || tone}</div>
            </div>
            <div>
              <span className="muted">Format</span>
              <div className="status-value">{run.format || format}</div>
            </div>
            <div>
              <span className="muted">Tokens</span>
              <div className="status-value">
                {run.tokensTotal ? `${run.tokensTotal} tokens` : "-"}
              </div>
            </div>
          </div>
          {streamWarning ? <p className="warning-banner">{streamWarning}</p> : null}
          {run.error ? <p className="error-banner">{run.error}</p> : null}
        </Panel>
      </div>

      <div className="builder-output">
        <Panel title="Draft">
          {run.draft ? (
            <>
              <div className="draft-toolbar">
                <Button variant="secondary" onClick={handleCopy}>
                  Copy draft
                </Button>
                <div className="download-controls">
                  <select
                    className="field-input download-select"
                    value={downloadFormat}
                    onChange={(event) => setDownloadFormat(event.target.value)}
                  >
                    {downloadOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={handleDownload}>
                    Download
                  </Button>
                </div>
              </div>
              <pre className="draft-text">{run.draft}</pre>
            </>
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
