import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, dataOf } from "../../lib/api";
import { Loading } from "../../components/States";

const fields = [
  "condition",
  "criticality",
  "traffic",
  "age",
  "failureHistory",
  "inspectionStatus",
  "dependencyImpact",
];
export default function RiskConfigPanel() {
  const query = useQuery({
    queryKey: ["risk-config"],
    queryFn: () => dataOf(api.get("/risk-config")),
  });
  const [weights, setWeights] = useState({});
  useEffect(() => {
    if (query.data?.weights) setWeights(query.data.weights);
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      dataOf(
        api.put("/risk-config", {
          weights: Object.fromEntries(
            fields.map((key) => [key, Number(weights[key] || 0)]),
          ),
        }),
      ),
    onSuccess: () => toast.success("Risk weights saved"),
    onError: (error) =>
      toast.error(error.response?.data?.error || "Could not save weights"),
  });
  const recompute = useMutation({
    mutationFn: () => dataOf(api.post("/risk/recompute-all")),
    onSuccess: (data) =>
      toast.success(`${data.count} risk assessments recomputed`),
    onError: (error) =>
      toast.error(error.response?.data?.error || "Recompute failed"),
  });
  if (query.isLoading) return <Loading />;
  return (
    <section className="panel risk-config">
      <div className="panel-heading">
        <span>
          <small>Risk engine</small>
          <h2>Risk weights</h2>
        </span>
        <button
          className="secondary-button"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
        >
          Recompute all
        </button>
      </div>
      <div className="weight-grid">
        {fields.map((key) => (
          <label key={key}>
            {key}
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={weights[key] ?? ""}
              onChange={(event) =>
                setWeights({ ...weights, [key]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <button
        className="primary-button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Save weights
      </button>
    </section>
  );
}
