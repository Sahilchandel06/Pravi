import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api, dataOf, uploadFile } from "../../lib/api";
import { Badge, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";

const ratings = ["GOOD", "MODERATE", "POOR", "CRITICAL"];
export default function InspectionForm() {
  const { assetId } = useParams();
  const query = useQuery({
    queryKey: ["inspect-asset", assetId],
    queryFn: () => dataOf(api.get(`/assets/${assetId}`)),
  });
  const [values, setValues] = useState({});
  const [observations, setObservations] = useState("");
  const [photos, setPhotos] = useState([]);
  const [result, setResult] = useState(null);
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const asset = query.data;
  async function submit(event) {
    event.preventDefault();
    try {
      const response = await dataOf(
        api.post("/inspections", {
          assetId,
          results: asset.children.map((child) => ({
            componentId: child.assetId,
            rating: values[child.assetId] || child.condition?.rating || "GOOD",
            notes: "",
          })),
          observations,
          photos: [],
        }),
      );
      setResult(response);
      toast.success("Inspection recorded");
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not save inspection");
    }
  }
  return (
    <>
      <Link className="back-link" to={`/assets/${assetId}`}>
        &larr; Asset profile
      </Link>
      <PageHeader eyebrow="Condition inspection" title={asset.name} />
      <form className="panel inspection-form" onSubmit={submit}>
        <p className="muted">
          Rate each component based on the latest field observation.
        </p>
        {asset.children?.map((child) => (
          <div className="rating-row" key={child.assetId}>
            <span>
              <b>{child.name}</b>
              <small>
                {child.assetId} / current {child.condition?.score}
              </small>
            </span>
            <div className="rating-options">
              {ratings.map((rating) => (
                <button
                  type="button"
                  className={
                    values[child.assetId] === rating
                      ? `selected ${rating.toLowerCase()}`
                      : ""
                  }
                  onClick={() =>
                    setValues({ ...values, [child.assetId]: rating })
                  }
                  key={rating}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        ))}

        <label>
          Observations
          <textarea
            rows="4"
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            placeholder="Record field observations..."
          />
        </label>
        <button className="primary-button">Save inspection</button>
      </form>
      {result && (
        <section className="result-card">
          <p className="eyebrow">Inspection complete</p>
          <h2>
            Condition {result.conditionBefore} → {result.conditionAfter}
          </h2>
          <div className="metrics">
            <span>
              Priority <Badge>{result.risk.level}</Badge>
            </span>
            <span>
              Risk score <b>{result.risk.score}</b>
            </span>
            <span>
              Action <b>{result.recommendedAction}</b>
            </span>
          </div>
          {result.createdRequestId && (
            <p className="success-text">
              A maintenance request was created for manager approval.
            </p>
          )}
        </section>
      )}
    </>
  );
}
