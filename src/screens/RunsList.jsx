import { useEffect, useState } from "react";
import { deleteRun, listRuns } from "../api.js";
import Button from "../components/Button.jsx";
import Panel from "../components/Panel.jsx";

const statusOptions = ["", "queued", "running", "complete", "error"];
const pageSizes = [10, 25, 50, 100];

export default function RunsList({ onSelectRun }) {
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const loadRuns = async () => {
    setLoading(true);
    setError("");
    try {
      const page = await listRuns({ status: status || undefined, limit, offset });
      setItems(page.items || []);
      setTotal(page.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [status, limit, offset]);

  const handleRetry = () => {
    loadRuns();
  };

  const handlePrev = () => {
    setOffset((prev) => Math.max(prev - limit, 0));
  };

  const handleNext = () => {
    setOffset((prev) => prev + limit);
  };

  const handleDelete = async (runId) => {
    const confirmDelete = window.confirm(
      "Delete this run? This action cannot be undone."
    );
    if (!confirmDelete) {
      return;
    }
    setDeletingId(runId);
    setError("");
    try {
      await deleteRun(runId);
      await loadRuns();
    } catch (err) {
      setError(err.message || "Failed to delete run.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="runs">
      <header className="runs-header">
        <div>
          <p className="eyebrow">Runs</p>
          <h1>Run History</h1>
          <p className="subhead">
            Browse completed and in-progress runs stored in SQLite.
          </p>
        </div>
        <div className="runs-controls">
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(event) => {
                setOffset(0);
                setStatus(event.target.value);
              }}
            >
              {statusOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Page size</span>
            <select
              className="field-input"
              value={limit}
              onChange={(event) => {
                setOffset(0);
                setLimit(Number(event.target.value));
              }}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <Panel title="Runs">
        {loading ? <p className="muted">Loading runs...</p> : null}
        {error ? (
          <div className="error-stack">
            <p className="error-banner">{error}</p>
            <Button variant="secondary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="muted">No runs found.</p>
        ) : null}
        {items.length ? (
          <div className="runs-table">
            <div className="runs-row runs-head">
              <span>ID</span>
              <span>Topic</span>
              <span>Status</span>
              <span>Updated</span>
              <span></span>
            </div>
            {items.map((run) => (
              <div
                key={run.id}
                className="runs-row runs-item"
                role="button"
                tabIndex={0}
                onClick={() => onSelectRun?.(run.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRun?.(run.id);
                  }
                }}
              >
                <span className="mono">{run.id.slice(0, 8)}</span>
                <span>{run.topic}</span>
                <span className={`run-status run-${run.status}`}>{run.status}</span>
                <span className="muted">
                  {new Date(run.updatedAt).toLocaleString()}
                </span>
                <div>
                  <Button
                    variant="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(run.id);
                    }}
                    disabled={deletingId === run.id}
                  >
                    {deletingId === run.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      <div className="runs-pagination">
        <Button variant="secondary" disabled={!canPrev} onClick={handlePrev}>
          Prev
        </Button>
        <span className="muted">
          {offset + 1}-{Math.min(offset + limit, total)} of {total}
        </span>
        <Button variant="secondary" disabled={!canNext} onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
