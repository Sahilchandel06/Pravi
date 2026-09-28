import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="ui-page-header">
      <div>
        <div className="breadcrumb">
          <Link to="/">InfraLife</Link>
          <ChevronRight size={13} />
          <span>{eyebrow}</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-actions">{actions}</div>
    </header>
  );
}
export function Tabs({ items, value, onChange }) {
  return (
    <div className="ui-tabs">
      {items.map((item) => (
        <button
          key={item}
          className={value === item ? "active" : ""}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
