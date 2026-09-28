import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, dataOf, uploadFile } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Badge, Empty, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";

const columns = ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED"];
const labels = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

export default function MaintenancePage() {
  const { user } = useAuth();
  const requests = useQuery({
    queryKey: ["maintenance-requests"],
    queryFn: () => dataOf(api.get("/maintenance/requests")),
  });
  const orders = useQuery({
    queryKey: ["work-orders"],
    queryFn: () => dataOf(api.get("/work-orders")),
  });
  const [drawer, setDrawer] = useState(null);
  const [dragged, setDragged] = useState(null);
  async function act(url, method = "post", body) {
    try {
      await api({ url, method, data: body });
      await requests.refetch();
      await orders.refetch();
      if (drawer)
        setDrawer((current) =>
          current
            ? { ...current, status: body?.status || current.status }
            : current,
        );
      toast.success("Work order updated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Update failed");
    }
  }
  async function transition(order, status, evidence = "") {
    if (status === "COMPLETED" && !evidence) {
      setDrawer(order);
      toast.error("Completion evidence is required");
      return;
    }
    await act(`/work-orders/${order._id}/status`, "patch", {
      status,
      ...(status === "COMPLETED" ? { completionEvidence: [evidence] } : {}),
    });
  }
  function drop(status) {
    if (!dragged || dragged.status === status) return;
    transition(dragged, status);
    setDragged(null);
  }
  if (requests.isLoading || orders.isLoading) return <Loading />;
  if (requests.error || orders.error)
    return <ErrorState error={requests.error || orders.error} />;
  const pending = requests.data.filter(
    (request) => request.status === "PENDING",
  );
  return (
    <>
      <PageHeader eyebrow="Maintenance control" title="Interventions" />
      <section className="panel">
        <div className="panel-heading">
          <span>
            <small>Manager queue</small>
            <h2>Pending requests</h2>
          </span>
        </div>
        {pending.map((request) => (
          <div className="request-row" key={request._id}>
            <span>
              <b>{request.asset?.assetId}</b>
              <small>{request.issue}</small>
            </span>
            <Badge>{request.priority}</Badge>
            {["MANAGER", "ADMIN"].includes(user.role) && (
              <span className="row-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    act(`/maintenance/requests/${request._id}/reject`)
                  }
                >
                  Reject
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    act(
                      `/maintenance/requests/${request._id}/approve`,
                      "post",
                      {
                        assignedTeam: "Infrastructure maintenance",
                        estimatedCost: request.estimatedCost || 0,
                      },
                    )
                  }
                >
                  Approve
                </button>
              </span>
            )}
          </div>
        ))}
        {!pending.length && <Empty label="No pending maintenance requests." />}
      </section>
      <section className="panel kanban-panel">
        <div className="panel-heading">
          <span>
            <small>Execution board</small>
            <h2>Work orders</h2>
          </span>
          <small>Drag cards or use the drawer actions</small>
        </div>
        <div className="kanban-board">
          {columns.map((status) => (
            <div
              className="kanban-column"
              key={status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => drop(status)}
            >
              <div className="kanban-column-head">
                <b>{labels[status]}</b>
                <span>
                  {
                    orders.data.filter((order) => order.status === status)
                      .length
                  }
                </span>
              </div>
              {orders.data
                .filter((order) => order.status === status)
                .map((order) => (
                  <WorkOrderCard
                    key={order._id}
                    order={order}
                    user={user}
                    onOpen={() => setDrawer(order)}
                    onDragStart={() => setDragged(order)}
                  />
                ))}
            </div>
          ))}
        </div>
      </section>
      {drawer && (
        <WorkOrderDrawer
          order={orders.data.find((item) => item._id === drawer._id) || drawer}
          user={user}
          onClose={() => setDrawer(null)}
          transition={transition}
        />
      )}
    </>
  );
}

function WorkOrderCard({ order, onOpen, onDragStart }) {
  return (
    <article
      className="work-card"
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
    >
      <div className="work-card-top">
        <b>#{order.woNumber}</b>
        <Badge>{order.priority}</Badge>
      </div>
      <h3>{order.asset?.assetId}</h3>
      <p>{order.issue || "Maintenance intervention"}</p>
      <small>{order.assignedTeam || "Unassigned"}</small>
      <div className="work-card-footer">
        {order.dueDate
          ? new Date(order.dueDate).toLocaleDateString()
          : "No due date"}
        <span>Open details →</span>
      </div>
    </article>
  );
}

function WorkOrderDrawer({ order, user, onClose, transition }) {
  const [evidence, setEvidence] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const canMaintain = ["MAINTENANCE", "ADMIN"].includes(user.role);
  const canClose = ["MANAGER", "ADMIN"].includes(user.role);
  async function complete() {
    try {
      const upload = evidenceFile ? await uploadFile(evidenceFile) : null;
      await transition(order, "COMPLETED", upload?.url || evidence);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Evidence upload failed");
    }
  }
  return (
    <aside className="workorder-drawer">
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <p className="eyebrow">Work order #{order.woNumber}</p>
      <h2>{order.asset?.assetId}</h2>
      <Badge>{order.status}</Badge>
      <dl>
        <dt>Issue</dt>
        <dd>{order.issue || "-"}</dd>
        <dt>Priority</dt>
        <dd>
          <Badge>{order.priority}</Badge>
        </dd>
        <dt>Team</dt>
        <dd>{order.assignedTeam || "Unassigned"}</dd>
        <dt>Estimated cost</dt>
        <dd>₹ {Number(order.estimatedCost || 0).toLocaleString("en-IN")}</dd>
        <dt>Due date</dt>
        <dd>
          {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "-"}
        </dd>
      </dl>
      <h3>Evidence links</h3>
      {order.completionEvidence?.length ? (
        order.completionEvidence.map((url) => (
          <a
            className="evidence-link"
            href={url}
            target="_blank"
            rel="noreferrer"
            key={url}
          >
            {url}
          </a>
        ))
      ) : (
        <p className="muted">No evidence uploaded.</p>
      )}
      <div className="drawer-actions">
        {order.status === "OPEN" && canMaintain && (
          <button
            className="secondary-button"
            onClick={() => transition(order, "IN_PROGRESS")}
          >
            Start work
          </button>
        )}
        {order.status === "IN_PROGRESS" && canMaintain && (
          <>
            <input
              placeholder="Evidence URL"
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            />
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setEvidenceFile(event.target.files[0])}
            />
            <button className="primary-button" onClick={complete}>
              Complete work
            </button>
          </>
        )}
        {order.status === "COMPLETED" && canClose && (
          <button
            className="primary-button"
            onClick={() => {
              transition(order, "CLOSED");
              onClose();
            }}
          >
            Close work order
          </button>
        )}
      </div>
    </aside>
  );
}
