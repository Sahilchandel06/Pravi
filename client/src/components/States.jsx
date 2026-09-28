export function Loading({ label = "Loading data..." }) {
  return (
    <div className="state">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Empty({ label = "No records found." }) {
  return <div className="state muted">{label}</div>;
}
export function ErrorState({ error }) {
  return (
    <div className="state error-state">
      {error?.response?.data?.error || "Unable to load this view."}
    </div>
  );
}
export function Badge({ children, tone }) {
  return (
    <span
      className={`badge ${tone || String(children).toLowerCase().replaceAll("_", "-")}`}
    >
      {children}
    </span>
  );
}
