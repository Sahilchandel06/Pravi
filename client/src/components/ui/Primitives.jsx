import { useEffect } from "react";
import { RefreshCcw, X } from "lucide-react";
import { statusLabel } from "../../lib/format";
export function Card({ children, className = "" }) {
  return <section className={`ui-card ${className}`}>{children}</section>;
}
export const SectionCard = Card;
export function StatusBadge({ value }) {
  return (
    <span className={`semantic-badge status-${value}`}>
      ● {statusLabel(value)}
    </span>
  );
}
export function RiskBadge({ value }) {
  return (
    <span className={`semantic-badge risk-${value}`}>
      ● {value || "Unassessed"}
    </span>
  );
}
export function RatingBadge({ value }) {
  return (
    <span className={`semantic-badge rating-${value}`}>
      ● {statusLabel(value)}
    </span>
  );
}
export function ScoreBar({ score = 0 }) {
  return (
    <span className="score-bar">
      <i style={{ width: `${score}%` }} />
    </span>
  );
}
export function ConditionGauge({ score = 0 }) {
  return (
    <div className="condition-gauge" style={{ "--score": `${score}%` }}>
      <strong>{score}</strong>
      <small>/100 condition</small>
    </div>
  );
}
export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}
export function EmptyState({ title = "Nothing here yet", action }) {
  return (
    <div className="ui-empty">
      <div className="empty-mark">+</div>
      <b>{title}</b>
      {action}
    </div>
  );
}
export function ErrorState({ message = "Something went wrong", retry }) {
  return (
    <div className="ui-error">
      <b>{message}</b>
      {retry && (
        <button onClick={retry}>
          <RefreshCcw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}
export function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside className="ui-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>
        {children}
      </aside>
    </div>
  );
}
export function Modal({ open, onClose, title, children }) {
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      {children}
    </Drawer>
  );
}
