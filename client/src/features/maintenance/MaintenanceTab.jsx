import { useQuery } from "@tanstack/react-query";
import { api, dataOf } from "../../lib/api";
import { Badge, Empty, Loading } from "../../components/States";
export default function MaintenanceTab({ assetId }) {
  const cost = useQuery({
    queryKey: ["cost", assetId],
    queryFn: () => dataOf(api.get(`/assets/${assetId}/maintenance-cost`)),
  });
  const orders = useQuery({
    queryKey: ["work-orders", assetId],
    queryFn: async () =>
      (await dataOf(api.get("/work-orders"))).filter(
        (order) =>
          order.asset?._id === assetId || order.asset?.assetId === assetId,
      ),
  });
  if (cost.isLoading || orders.isLoading) return <Loading />;
  return (
    <div className="detail-grid">
      <section className="panel">
        <div className="panel-heading">
          <span>
            <small>Maintenance spend</small>
            <h2>Yearly cost</h2>
          </span>
        </div>
        {cost.data.trendWarning && (
          <div className="warning-banner">{cost.data.trendWarning}</div>
        )}
        {cost.data.yearlySpend.map((row) => (
          <div className="cost-row" key={row.year}>
            <span>{row.year}</span>
            <strong>₹ {(row.amount / 100000).toFixed(1)}L</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <span>
            <small>Execution</small>
            <h2>Work orders</h2>
          </span>
        </div>
        {orders.data.length ? (
          orders.data.map((order) => (
            <div className="request-row" key={order._id}>
              <span>
                <b>#{order.woNumber}</b>
                <small>{order.issue}</small>
              </span>
              <Badge>{order.status}</Badge>
            </div>
          ))
        ) : (
          <Empty label="No work orders for this asset." />
        )}
      </section>
    </div>
  );
}
