import { useQuery } from "@tanstack/react-query";
import { api, dataOf } from "../../lib/api";
import { Empty, ErrorState, Loading } from "../../components/States";

export default function AuditTab({ entityId }) {
  const query = useQuery({
    queryKey: ["audit", entityId],
    queryFn: () =>
      dataOf(api.get("/audit", { params: { entityId, limit: 100 } })),
  });
  if (query.isLoading) return <Loading label="Loading audit history..." />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <section className="panel audit-list">
      {query.data.length ? (
        query.data.map((entry) => (
          <article className="audit-entry" key={entry._id}>
            <div className="audit-meta">
              <b>{entry.user?.name || "System"}</b>
              <span>
                {entry.action} · {entry.entity}
              </span>
              <time>{new Date(entry.at).toLocaleString()}</time>
            </div>
            <div className="audit-change">
              <div>
                <small>Before</small>
                <pre>{JSON.stringify(entry.before, null, 2) || "-"}</pre>
              </div>
              <div>
                <small>After</small>
                <pre>{JSON.stringify(entry.after, null, 2) || "-"}</pre>
              </div>
            </div>
          </article>
        ))
      ) : (
        <Empty label="No audit entries for this asset." />
      )}
    </section>
  );
}
