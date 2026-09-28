import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api, dataOf } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Badge, ErrorState, Loading } from "../../components/States";

const edgeColors = {
  CONTAINS: "#87918a",
  DEPENDS_ON: "#d9893d",
  DRAINS_TO: "#5578a8",
  CONNECTS_TO: "#536b5d",
};
const statusColors = {
  CRITICAL: "#c85a48",
  ATTENTION: "#d99b3d",
  UNDER_MAINTENANCE: "#5578a8",
  HEALTHY: "#2f6b4f",
};

export default function DependencyGraph({ assetId, asset }) {
  const global = !assetId;
  const { user } = useAuth();
  const canEdit = ["MANAGER", "ADMIN"].includes(user?.role);
  const [direction, setDirection] = useState("both");
  const [depth, setDepth] = useState(3);
  const [edgeTypes, setEdgeTypes] = useState(Object.keys(edgeColors));
  const [selected, setSelected] = useState(null);
  const [impact, setImpact] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [
      global ? "network-graph" : "graph",
      assetId,
      direction,
      depth,
      edgeTypes,
    ],
    queryFn: () =>
      dataOf(
        api.get(global ? "/graph" : `/graph/${assetId}`, {
          params: global
            ? { types: edgeTypes.join(","), limit: 300 }
            : { direction, depth },
        }),
      ),
  });
  const critical = useQuery({
    queryKey: ["critical-nodes"],
    queryFn: () => dataOf(api.get("/graph/critical-nodes")),
  });
  const criticalIds = new Set(
    (critical.data || []).map((item) => item.assetId),
  );
  const nodes = useMemo(
    () =>
      (query.data?.nodes || []).map((node, index) => ({
        id: node.id,
        position: { x: (index % 5) * 190, y: Math.floor(index / 5) * 120 },
        data: {
          label: (
            <div>
              <b>{node.assetId}</b>
              <small>
                {node.typeKey}
                <br />
                {node.conditionScore ?? "-"}/100 · {node.riskLevel || "-"}
              </small>
            </div>
          ),
        },
        style: {
          border: `2px solid ${criticalIds.has(node.assetId) ? "#7b3f34" : statusColors[node.status] || "#87918a"}`,
          background: criticalIds.has(node.assetId) ? "#fff0e8" : "#fff",
        },
      })),
    [query.data, critical.data],
  );
  if (query.isLoading || critical.isLoading)
    return <Loading label="Loading dependency graph..." />;
  if (query.error) return <ErrorState error={query.error} />;
  const edges = (query.data.edges || []).filter((edge) =>
    edgeTypes.includes(edge.type),
  );
  const showImpact = async (selectedNode) => {
    try {
      setImpact(await dataOf(api.get(`/graph/${selectedNode.assetId}/impact`)));
    } catch (error) {
      toast.error(error.response?.data?.error || "Impact analysis failed");
    }
  };
  const toggleType = (type) =>
    setEdgeTypes((items) =>
      items.includes(type)
        ? items.filter((item) => item !== type)
        : [...items, type],
    );
  const deleteEdge = async () => {
    try {
      await api.delete(`/relationships/${selectedEdge.id}`);
      toast.success("Dependency deleted");
      setSelectedEdge(null);
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      query.refetch();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not delete dependency");
    }
  };
  return (
    <div className="graph-layout">
      <section className="panel graph-panel">
        <div className="graph-controls">
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            disabled={global}
          >
            <option>both</option>
            <option>upstream</option>
            <option>downstream</option>
          </select>
          <select
            value={depth}
            onChange={(event) => setDepth(Number(event.target.value))}
            disabled={global}
          >
            <option value="1">1 hop</option>
            <option value="3">3 hops</option>
            <option value="5">5 hops</option>
          </select>
          {global && (
            <div className="edge-toggles">
              {Object.keys(edgeColors).map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={edgeTypes.includes(type)}
                    onChange={() => toggleType(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          )}
          {!global && canEdit && (
            <button
              className="primary-button"
              onClick={() => setModalOpen(true)}
            >
              Add dependency
            </button>
          )}
        </div>
        <div className="flow">
          <ReactFlow
            nodes={nodes}
            edges={edges.map((edge) => ({
              ...edge,
              label: edge.type,
              style: { stroke: edgeColors[edge.type] },
              strokeWidth: 2,
              animated: edge.type === "DEPENDS_ON",
            }))}
            onNodeClick={(_, node) => {
              const item = query.data.nodes.find(
                (value) => value.id === node.id,
              );
              setSelected(item);
              showImpact(item);
            }}
            onEdgeClick={(_, edge) => setSelectedEdge(edge)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </section>
      {(selected || impact || selectedEdge) && (
        <aside className="panel graph-side">
          <p className="eyebrow">Dependency analysis</p>
          {selected && (
            <>
              <h2>{selected.assetId}</h2>
              <Badge>{selected.riskLevel || "UNASSESSED"}</Badge>
              <p className="muted">{selected.name}</p>
              <Link
                className="secondary-button block"
                to={`/assets/${selected.assetId}`}
              >
                Open asset
              </Link>
            </>
          )}
          {selectedEdge && canEdit && !global && (
            <button className="danger-button block" onClick={deleteEdge}>
              Delete {selectedEdge.label} edge
            </button>
          )}
          {impact && (
            <>
              <h3>Affected assets</h3>
              {impact.affected.map((item) => (
                <div className="impact-row" key={item.asset.assetId}>
                  <span>
                    {item.asset.assetId}
                    <small>
                      {item.hops} hops · {item.reason}
                    </small>
                  </span>
                  <b>{item.impactScore}</b>
                </div>
              ))}
            </>
          )}
        </aside>
      )}
      {modalOpen && (
        <DependencyModal
          asset={asset}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            query.refetch();
          }}
        />
      )}
    </div>
  );
}

function DependencyModal({ asset, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [error, setError] = useState("");
  const types = useQuery({
    queryKey: ["asset-types"],
    queryFn: () => dataOf(api.get("/asset-types")),
  });
  const assets = useQuery({
    queryKey: ["dependency-assets"],
    queryFn: () => dataOf(api.get("/assets", { params: { limit: 300 } })),
  });
  if (types.isLoading || assets.isLoading)
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <Loading label="Loading dependency rules..." />
        </div>
      </div>
    );
  const sourceType = types.data.find((item) => item.key === asset.typeKey);
  const allAssets = assets.data.items || [];
  const targets = allAssets.filter(
    (item) =>
      item._id !== asset._id &&
      sourceType?.allowedRelationships?.some(
        (rule) => rule.toTypeKey === item.typeKey,
      ),
  );
  const target = allAssets.find((item) => item._id === targetId);
  const allowed =
    sourceType?.allowedRelationships?.filter(
      (rule) => rule.toTypeKey === target?.typeKey,
    ) || [];
  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/relationships", {
        from: asset._id,
        to: targetId,
        type: relationshipType,
        weight: 1,
      });
      toast.success("Dependency added");
      queryClient.invalidateQueries({ queryKey: ["asset", asset.assetId] });
      onCreated();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Could not create dependency",
      );
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="panel-heading">
          <span>
            <small>Dependency editor</small>
            <h2>Add dependency</h2>
          </span>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="muted">Only AssetType.allowedRelationships are shown.</p>
        <label>
          Target asset
          <select
            required
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              setRelationshipType("");
            }}
          >
            <option value="">Select target</option>
            {targets.map((item) => (
              <option key={item._id} value={item._id}>
                {item.assetId} · {item.name} ({item.typeKey})
              </option>
            ))}
          </select>
        </label>
        <label>
          Relationship type
          <select
            required
            value={relationshipType}
            onChange={(event) => setRelationshipType(event.target.value)}
          >
            <option value="">Select type</option>
            {allowed.map((rule) => (
              <option key={rule.type} value={rule.type}>
                {rule.type}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button">Create dependency</button>
        </div>
      </form>
    </div>
  );
}
