import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Layers,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { api, dataOf } from "../../lib/api";
import {
  formatCount,
  formatINR,
  statusLabel,
  typeIcon,
} from "../../lib/format";
import {
  Card,
  RiskBadge,
  ScoreBar,
  StatusBadge,
} from "../../components/ui/Primitives";
import { ErrorState, Loading } from "../../components/States";
import { PageHeader as SystemPageHeader } from "../../components/ui/Navigation";

const riskOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const riskColors = {
  LOW: "#2f7d5b",
  MEDIUM: "#d9a21b",
  HIGH: "#e07b2e",
  CRITICAL: "#c8402e",
};
const statusIcons = {
  total: Layers,
  critical: ShieldAlert,
  attention: AlertTriangle,
  overdue: ClipboardCheck,
  work: Wrench,
};

export default function Dashboard() {
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: () => dataOf(api.get("/dashboard/summary")),
  });
  const critical = useQuery({
    queryKey: ["critical-nodes"],
    queryFn: () => dataOf(api.get("/graph/critical-nodes")),
  });
  if (summary.isLoading)
    return <Loading label="Loading corridor intelligence..." />;
  if (summary.error)
    return (
      <ErrorState
        message="Could not load dashboard"
        retry={() => summary.refetch()}
      />
    );
  const data = summary.data;
  const status = data.byStatus || {};
  const risk = riskOrder.map((level) => ({
    level,
    count: data.riskDistribution?.[level] || 0,
  }));
  const total = data.totals.assets || 0;
  const cards = [
    ["Total assets", total, `${data.totals.types} registered types`, "total"],
    ["Critical", status.CRITICAL || 0, "Needs action now", "critical"],
    [
      "Attention",
      status.ATTENTION || 0,
      `${total ? Math.round(((status.ATTENTION || 0) / total) * 100) : 0}% of network`,
      "attention",
    ],
    [
      "Overdue inspections",
      data.overdueInspections,
      "Requires scheduling",
      "overdue",
    ],
    [
      "Open work orders",
      data.openWorkOrders,
      data.openWorkOrders ? "Active interventions" : "No open work",
      "work",
    ],
  ];
  return (
    <>
      <SystemPageHeader
        eyebrow="Monday / 28 September 2026"
        title="Corridor dashboard"
        subtitle="Ahmedabad - Vadodara, NH-XX"
        actions={
          <span className="live-label">
            <i />
            Live data
          </span>
        }
      />
      <section className="kpi-grid">
        {cards.map(([label, value, context, iconKey]) => {
          const Icon = statusIcons[iconKey];
          return (
            <Link
              className={`kpi kpi-${iconKey}`}
              to={iconKey === "total" ? "/assets" : "/assets"}
              key={label}
            >
              <div>
                <span>{label}</span>
                <Icon size={16} />
              </div>
              <strong>{formatCount(value)}</strong>
              <small>{context}</small>
            </Link>
          );
        })}
      </section>
      <div className="dashboard-bento">
        <Card className="priority-hero">
          <div className="panel-heading">
            <span>
              <small>Priority queue</small>
              <h2>Assets needing a decision</h2>
            </span>
            <Link className="text-link" to="/assets">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="priority-list">
            {data.topPriority?.map((item, index) => (
              <Link
                className="priority-item"
                to={`/assets/${item.assetId}`}
                key={item.assetId}
              >
                <b className="rank">0{index + 1}</b>
                <span className="type-glyph">{typeIcon(item.typeKey)}</span>
                <span className="priority-name">
                  <b>{item.assetId}</b>
                  <small>{item.name}</small>
                </span>
                <span className="priority-score">
                  <ScoreBar score={Math.max(0, 100 - item.score)} />
                  <small>
                    {Math.max(0, 100 - item.score)}/100 condition proxy
                  </small>
                </span>
                <RiskBadge value={item.riskLevel} />
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </Card>
        <Card className="health-card">
          <div className="panel-heading">
            <span>
              <small>Network health</small>
              <h2>Status distribution</h2>
            </span>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="52%" height={190}>
              <PieChart>
                <Pie
                  data={Object.entries(status).map(([name, value]) => ({
                    name,
                    value,
                  }))}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {Object.entries(status).map(([name]) => (
                    <Cell
                      key={name}
                      fill={
                        name === "HEALTHY"
                          ? "#2f7d5b"
                          : name === "ATTENTION"
                            ? "#d9a21b"
                            : name === "CRITICAL"
                              ? "#c8402e"
                              : "#3b6fb6"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="health-legend">
              {Object.entries(status).map(([name, value]) => (
                <div key={name}>
                  <span>
                    <i className={`dot dot-${name}`} />
                    {statusLabel(name)}
                  </span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="panel-heading">
            <span>
              <small>Risk distribution</small>
              <h2>Current exposure</h2>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={risk}
              margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis dataKey="level" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 2, 2]}>
                {risk.map((item) => (
                  <Cell key={item.level} fill={riskColors[item.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="panel-heading">
            <span>
              <small>Maintenance spend</small>
              <h2>Lifecycle investment</h2>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={data.maintenanceSpend || []}
              margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(value) => `Rs ${Math.round(value / 100000)}L`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => formatINR(value)}
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              />
              <Bar dataKey="total" fill="var(--accent)" radius={[6, 6, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="failure-card">
          <div className="panel-heading">
            <span>
              <small>Dependency watch</small>
              <h2>Single points of failure</h2>
            </span>
            <ShieldAlert size={17} />
          </div>
          <p className="card-caption">
            Bridges and road segments with the widest downstream effect.
          </p>
          {critical.isLoading ? (
            <Loading />
          ) : (
            critical.data
              ?.filter((item) =>
                ["bridge", "road_segment"].includes(item.typeKey),
              )
              .slice(0, 5)
              .map((item) => (
                <Link
                  className="failure-row"
                  to={`/assets/${item.assetId}`}
                  key={item.assetId}
                >
                  <span>
                    <b>{item.assetId}</b>
                    <small>{item.name}</small>
                  </span>
                  <strong>
                    Affects {item.downstreamDependents || 0} assets
                  </strong>
                </Link>
              ))
          )}
        </Card>
      </div>
    </>
  );
}
export function PageHeader({ eyebrow, title, action }) {
  return <SystemPageHeader eyebrow={eyebrow} title={title} actions={action} />;
}
