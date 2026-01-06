const labels = {
  idle: "Idle",
  queued: "Queued",
  running: "Running",
  complete: "Complete",
  error: "Error"
};

export default function StatusBadge({ status = "idle" }) {
  const label = labels[status] || "Unknown";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}
