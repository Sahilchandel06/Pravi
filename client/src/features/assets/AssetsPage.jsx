import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Search, SlidersHorizontal } from "lucide-react";
import { api, dataOf } from "../../lib/api";
import { Badge, Empty, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";
export default function AssetsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    typeKey: "",
    page: 1,
  });
  const { data: types = [] } = useQuery({
    queryKey: ["types"],
    queryFn: () => dataOf(api.get("/asset-types")),
  });
  const query = useQuery({
    queryKey: ["assets", filters],
    queryFn: () =>
      dataOf(api.get("/assets", { params: { ...filters, limit: 20 } })),
  });
  const set = (key, value) => setFilters({ ...filters, [key]: value, page: 1 });
  return (
    <>
      <PageHeader
        eyebrow="Asset register"
        title="All infrastructure"
        action={
          <span className="header-actions">
            {["ADMIN", "MANAGER"].includes(user?.role) && (
              <Link className="primary-button" to="/assets/new">
                Add asset
              </Link>
            )}
            <Link className="secondary-button" to="/map">
              Open map
            </Link>
          </span>
        }
      />
      <section className="toolbar">
        <label className="search">
          <Search size={16} />
          <input
            placeholder="Search ID or name"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </label>
        <select
          value={filters.typeKey}
          onChange={(e) => set("typeKey", e.target.value)}
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {["HEALTHY", "ATTENTION", "CRITICAL", "UNDER_MAINTENANCE"].map(
            (status) => (
              <option key={status}>{status}</option>
            ),
          )}
        </select>
        <SlidersHorizontal size={18} />
      </section>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <section className="panel table-wrap">
          <div className="table-meta">
            {query.data.total} assets · page {query.data.page} of{" "}
            {query.data.pages || 1}
          </div>
          {query.data.items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Condition</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((asset) => (
                  <tr key={asset.assetId}>
                    <td>
                      <Link to={`/assets/${asset.assetId}`}>
                        <b>{asset.assetId}</b>
                        <small>{asset.name}</small>
                      </Link>
                    </td>
                    <td>{asset.typeKey.replaceAll("_", " ")}</td>
                    <td>
                      <div className="condition-bar">
                        <i
                          style={{ width: `${asset.condition?.score || 0}%` }}
                        />
                      </div>
                      {asset.condition?.score}/100
                    </td>
                    <td>
                      <Badge>{asset.riskLevel || "UNASSESSED"}</Badge>
                    </td>
                    <td>
                      <Badge>{asset.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty label="No assets match those filters." />
          )}
          <div className="pagination">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Previous
            </button>
            <button
              disabled={filters.page >= query.data.pages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </>
  );
}
