import { useEffect, useRef, useState } from "react";
import {
  createEventSource,
  createRewrite,
  deleteRun,
  getRewrite,
  getRun,
  listRewrites
} from "../api.js";
import Button from "../components/Button.jsx";
import Panel from "../components/Panel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { applyResult, applySnapshot, applyStatus, applyStep } from "../state/runState.js";
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

export default function RunDetail({ runId, onBack }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [streamWarning, setStreamWarning] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("md");
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState("");
  const [activeVariant, setActiveVariant] = useState(null);
  const [activeVariantId, setActiveVariantId] = useState("original");
  const [variantLoadingId, setVariantLoadingId] = useState("");
  const [rewriteTone, setRewriteTone] = useState("neutral");
  const [rewriteFormat, setRewriteFormat] = useState("blog");
  const [rewriting, setRewriting] = useState(false);
  const eventSourceRef = useRef(null);

  const attachStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = createEventSource(id);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => (prev ? applySnapshot(prev, data) : data));
    });

    es.addEventListener("step", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => (prev ? applyStep(prev, data.step) : prev));
    });

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => (prev ? applyStatus(prev, data.status, data.error) : prev));
    });

    es.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      setRun((prev) => (prev ? applyResult(prev, data) : prev));
      es.close();
    });

    es.onerror = async () => {
      setStreamWarning("Live connection interrupted. Refresh to continue.");
      try {
        const snapshot = await getRun(id);
        setRun((prev) => (prev ? applySnapshot(prev, snapshot) : snapshot));
      } catch (err) {
        setStreamWarning("Live connection interrupted. Unable to sync snapshot.");
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
        setRewriteTone(snapshot.tone || "neutral");
        setRewriteFormat(snapshot.format || "blog");
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

  useEffect(() => {
    let isMounted = true;
    const loadVariants = async () => {
      setVariantsLoading(true);
      setVariantsError("");
      try {
        const response = await listRewrites(runId);
        if (!isMounted) {
          return;
        }
        setVariants(response.items || []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setVariantsError(err.message || "Failed to load rewrites.");
      } finally {
        if (isMounted) {
          setVariantsLoading(false);
        }
      }
    };
    loadVariants();
    return () => {
      isMounted = false;
    };
  }, [runId]);

  const handleSelectVariant = async (variantId) => {
    if (variantId === "original") {
      setActiveVariant(null);
      setActiveVariantId("original");
      return;
    }
    setVariantLoadingId(variantId);
    setVariantsError("");
    try {
      const variant = await getRewrite(runId, variantId);
      setActiveVariant(variant);
      setActiveVariantId(variantId);
    } catch (err) {
      setVariantsError(err.message || "Failed to load rewrite.");
    } finally {
      setVariantLoadingId("");
    }
  };

  const handleRewrite = async () => {
    if (!run?.draft) {
      return;
    }
    setRewriting(true);
    setVariantsError("");
    try {
      const variant = await createRewrite(run.id, {
        tone: rewriteTone,
        format: rewriteFormat
      });
      setVariants((prev) => [variant, ...prev]);
      setActiveVariant(variant);
      setActiveVariantId(variant.id);
    } catch (err) {
      setVariantsError(err.message || "Failed to create rewrite.");
    } finally {
      setRewriting(false);
    }
  };

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

  const displayedDraft = activeVariant?.draft || run.draft;
  const displayedTokens =
    activeVariant?.tokensTotal ?? run.tokensTotal ?? 0;
  const displayedLabel = activeVariant
    ? `Rewrite: ${activeVariant.tone} / ${activeVariant.format}`
    : "Original draft";

  return (
    <div className="run-detail">
      <header className="run-detail-header">
        <div className="run-detail-actions">
          <Button variant="secondary" onClick={onBack}>
            Back to runs
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={async () => {
              const confirmDelete = window.confirm(
                "Delete this run? This action cannot be undone."
              );
              if (!confirmDelete) {
                return;
              }
              setDeleting(true);
              try {
                await deleteRun(run.id);
                onBack?.();
              } catch (err) {
                setError(err.message || "Failed to delete run.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
        <div>
          <p className="eyebrow">Run detail</p>
          <h1>{run.topic}</h1>
          <div className="status-row">
            <StatusBadge status={run.status} />
            <span className="muted">Run ID: {run.id}</span>
          </div>
          <div className="muted">Step: {run.step || "-"}</div>
          <div className="muted">Tone: {run.tone || "neutral"}</div>
          <div className="muted">Format: {run.format || "blog"}</div>
          <div className="muted">
            Tokens: {run.tokensTotal ? `${run.tokensTotal} tokens` : "-"}
          </div>
        </div>
      </header>

      {streamWarning ? <p className="warning-banner">{streamWarning}</p> : null}
      {run.error ? <p className="error-banner">{run.error}</p> : null}

      <div className="rewrite-section">
        <Panel title="Guidance">
          {run.guidance ? (
            <p className="guidance-text">{run.guidance}</p>
          ) : (
            <p className="muted">No guidance provided for this run.</p>
          )}
        </Panel>
        <Panel title="Rewrite">
          <div className="rewrite-grid">
            <label className="field">
              <span className="field-label">Tone</span>
              <select
                className="field-input"
                value={rewriteTone}
                onChange={(event) => setRewriteTone(event.target.value)}
              >
                {toneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Format</span>
              <select
                className="field-input"
                value={rewriteFormat}
                onChange={(event) => setRewriteFormat(event.target.value)}
              >
                {formatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rewrite-actions">
              <Button
                onClick={handleRewrite}
                disabled={rewriting || !run.draft}
              >
                {rewriting ? "Rewriting..." : "Rewrite draft"}
              </Button>
              <span className="muted">
                Uses the existing draft without re-running research.
              </span>
            </div>
          </div>
        </Panel>
        <Panel title="Variants">
          {variantsLoading ? <p className="muted">Loading rewrites...</p> : null}
          {variantsError ? <p className="error-banner">{variantsError}</p> : null}
          <div className="variant-list">
            <button
              type="button"
              className={`variant-item ${
                activeVariantId === "original" ? "is-active" : ""
              }`}
              onClick={() => handleSelectVariant("original")}
            >
              <div>
                <strong>Original</strong>
                <div className="variant-meta">
                  {run.tone || "neutral"} | {run.format || "blog"} |{" "}
                  {run.tokensTotal ? `${run.tokensTotal} tokens` : "No tokens"}
                </div>
              </div>
              <span className="muted">
                {new Date(run.updatedAt).toLocaleString()}
              </span>
            </button>
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={`variant-item ${
                  activeVariantId === variant.id ? "is-active" : ""
                }`}
                onClick={() => handleSelectVariant(variant.id)}
                disabled={variantLoadingId === variant.id}
              >
                <div>
                  <strong>
                    {variant.tone} | {variant.format}
                  </strong>
                  <div className="variant-meta">
                    {variant.tokensTotal
                      ? `${variant.tokensTotal} tokens`
                      : "No tokens"}
                  </div>
                </div>
                <span className="muted">
                  {new Date(variant.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="builder-output">
        <Panel title="Draft">
          {displayedDraft ? (
            <>
              <div className="draft-toolbar">
                <span className="muted">{displayedLabel}</span>
                <div className="download-controls">
                  <select
                    className="field-input download-select"
                    value={downloadFormat}
                    onChange={(event) => setDownloadFormat(event.target.value)}
                  >
                    <option value="md">Markdown (.md)</option>
                    <option value="txt">Text (.txt)</option>
                    <option value="html">HTML (.html)</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadContent({
                        content: displayedDraft,
                        filenameBase: run.topic,
                        format: downloadFormat
                      })
                    }
                  >
                    Download
                  </Button>
                </div>
              </div>
              <div className="draft-meta">
                <span className="muted">
                  Tokens: {displayedTokens ? `${displayedTokens} tokens` : "-"}
                </span>
              </div>
              <pre className="draft-text">{displayedDraft}</pre>
            </>
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

