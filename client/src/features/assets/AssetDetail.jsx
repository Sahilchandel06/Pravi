import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, GitBranch } from "lucide-react";
import { api, dataOf } from "../../lib/api";
import { Badge, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";
import { useAuth } from "../../context/AuthContext";
import InspectionForm from "../inspection/InspectionForm";
import DependencyGraph from "../graph/DependencyGraph";
import MaintenanceTab from "../maintenance/MaintenanceTab";
import DocumentsTab from "./DocumentsTab";
import AuditTab from "./AuditTab";
export default function AssetDetail() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => dataOf(api.get(`/assets/${assetId}`)),
  });
  if (query.isLoading) return <Loading label="Loading asset profile..." />;
  if (query.error) return <ErrorState error={query.error} />;
  const asset = query.data;
  const tabs = [
    "Overview",
    "Digital Twin",
    "Dependencies",
    "Maintenance",
    "Lifecycle",
    "Documents",
    ...(user && ["MANAGER", "ADMIN"].includes(user.role) ? ["Audit"] : []),
  ];
  return (
    <>
      <Link className="back-link" to="/assets">
        <ArrowLeft size={15} /> Inventory
      </Link>
      <PageHeader
        eyebrow={`${asset.typeKey} / ${asset.assetId}`}
        title={asset.name}
        action={
          <div className="header-actions">
            <Badge>{asset.status}</Badge>
            {["ADMIN", "MANAGER"].includes(user?.role) && (
              <Link
                className="primary-button"
                to={`/assets/${asset.assetId}/edit`}
              >
                Edit asset
              </Link>
            )}
            {user?.role === "INSPECTOR" && (
              <Link
                className="secondary-button"
                to={`/assets/${asset.assetId}/inspect`}
              >
                <ClipboardCheck size={16} /> Inspect
              </Link>
            )}
          </div>
        }
      />
      <div className="tab-bar">
        {tabs.map((value) => (
          <button
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "Overview" && <Overview asset={asset} />}
      {tab === "Digital Twin" && <DigitalTwin asset={asset} />}
      {tab === "Dependencies" && (
        <DependencyGraph assetId={assetId} asset={asset} />
      )}
      {tab === "Maintenance" && <MaintenanceTab assetId={assetId} />}
      {tab === "Lifecycle" && <Lifecycle assetId={assetId} />}
      {tab === "Documents" && <DocumentsTab assetId={assetId} />}
      {tab === "Audit" && <AuditTab entityId={asset._id} />}
    </>
  );
}
function Overview({ asset }) {
  const qr = useQuery({
    queryKey: ["asset-qr", asset.assetId],
    queryFn: () => dataOf(api.get(`/assets/${asset.assetId}/qr`)),
  });
  return (
    <div className="detail-grid">
      <section className="panel">
        <div className="panel-heading">
          <span>
            <small>Current condition</small>
            <h2>{asset.condition?.score}/100</h2>
          </span>
          <Badge>{asset.condition?.rating}</Badge>
        </div>
        <div className="gauge">
          <i style={{ width: `${asset.condition?.score || 0}%` }} />
        </div>
        <div className="metrics">
          <span>
            Criticality <b>{asset.criticality}</b>
          </span>
          <span>
            Traffic <b>{asset.trafficImportance}</b>
          </span>
          <span>
            Failures <b>{asset.failureHistoryCount}</b>
          </span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <span>
            <small>Latest risk</small>
            <h2>{asset.latestRisk?.score ?? "-"}/100</h2>
          </span>
          <Badge>{asset.latestRisk?.level || "UNASSESSED"}</Badge>
        </div>
        <ul className="reason-list">
          {asset.latestRisk?.reasons?.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <b>Recommended: {asset.latestRisk?.recommendedAction || "MONITOR"}</b>
      </section>
      <section className="panel full">
        <div className="panel-heading">
          <span>
            <small>Asset attributes</small>
            <h2>Technical record</h2>
          </span>
        </div>
        <div className="attribute-grid">
          {(asset.attributeSchema || []).map((field) => (
            <div key={field.key}>
              <small>
                {field.label}
                {field.unit ? ` (${field.unit})` : ""}
              </small>
              <b>{String(asset.attributes?.[field.key] ?? "-")}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="panel qr-panel" id="asset-qr">
        <div className="panel-heading">
          <span>
            <small>Field access</small>
            <h2>Inspection QR</h2>
          </span>
          <button className="secondary-button" onClick={() => window.print()}>
            Print
          </button>
        </div>
        {qr.isLoading ? (
          <Loading label="Generating QR..." />
        ) : qr.error ? (
          <ErrorState error={qr.error} />
        ) : (
          <div className="qr-content">
            <img
              src={qr.data.dataUrl}
              alt={`Inspection QR for ${asset.assetId}`}
            />
            <div>
              <p>
                Scan to open the inspection form for <b>{asset.assetId}</b>.
              </p>
              <small>{qr.data.url}</small>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
function DigitalTwin({ asset }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <span>
          <small>Component model</small>
          <h2>Weighted condition</h2>
        </span>
      </div>
      <p className="formula">
        {asset.condition?.breakdown
          ?.map(
            (item) =>
              `${item.component} ${item.score} × ${Math.round(item.weight * 100)}%`,
          )
          .join(" + ")}
      </p>
      {asset.children?.map((child) => (
        <div className="component-row" key={child.assetId}>
          <span>
            <b>{child.name}</b>
            <small>{child.assetId}</small>
          </span>
          <strong>{child.condition?.score}/100</strong>
          <div className="condition-bar">
            <i style={{ width: `${child.condition?.score || 0}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}
function Lifecycle({ assetId }) {
  const query = useQuery({
    queryKey: ["lifecycle", assetId],
    queryFn: () => dataOf(api.get(`/assets/${assetId}/lifecycle`)),
  });
  if (query.isLoading) return <Loading />;
  return (
    <section className="panel timeline">
      {query.data?.map((event) => (
        <div
          className={`timeline-event ${event.projected ? "projected" : ""}`}
          key={`${event.title}-${event.date}`}
        >
          <span>
            {new Date(event.date).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
            })}
          </span>
          <div>
            <b>{event.title}</b>
            <p>{event.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
export { InspectionForm };
