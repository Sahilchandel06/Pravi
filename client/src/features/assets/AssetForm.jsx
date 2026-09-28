import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { api, dataOf } from "../../lib/api";
import { Badge, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";

const blank = {
  assetId: "",
  name: "",
  typeKey: "",
  sector: "roads",
  constructedOn: "",
  expectedUsefulLifeYears: 25,
  criticality: 50,
  trafficImportance: 50,
  failureHistoryCount: 0,
  attributes: {},
  latitude: "22.65",
  longitude: "72.9",
};
export default function AssetForm() {
  const { assetId } = useParams();
  const edit = Boolean(assetId);
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const types = useQuery({
    queryKey: ["types"],
    queryFn: () => dataOf(api.get("/asset-types")),
  });
  const asset = useQuery({
    queryKey: ["asset-form", assetId],
    queryFn: () => dataOf(api.get(`/assets/${assetId}`)),
    enabled: edit,
  });
  useEffect(() => {
    if (asset.data) {
      const location =
        asset.data.location?.type === "Point"
          ? asset.data.location.coordinates
          : [72.9, 22.65];
      setForm({
        ...blank,
        ...asset.data,
        constructedOn: asset.data.constructedOn?.slice(0, 10) || "",
        latitude: location[1],
        longitude: location[0],
        attributes: asset.data.attributes || {},
      });
    }
  }, [asset.data]);
  const type = types.data?.find((item) => item.key === form.typeKey);
  if (types.isLoading || asset.isLoading) return <Loading />;
  if (types.error || asset.error)
    return <ErrorState error={types.error || asset.error} />;
  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function setAttribute(key, value, typeName) {
    const converted =
      typeName === "number"
        ? value === ""
          ? ""
          : Number(value)
        : typeName === "boolean"
          ? value === "true"
          : value;
    setForm((current) => ({
      ...current,
      attributes: { ...current.attributes, [key]: converted },
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = {
        assetId: form.assetId,
        name: form.name,
        typeKey: form.typeKey,
        sector: form.sector,
        attributes: form.attributes,
        constructedOn: form.constructedOn || undefined,
        expectedUsefulLifeYears: Number(form.expectedUsefulLifeYears),
        criticality: Number(form.criticality),
        trafficImportance: Number(form.trafficImportance),
        failureHistoryCount: Number(form.failureHistoryCount),
        location: {
          type: "Point",
          coordinates: [Number(form.longitude), Number(form.latitude)],
        },
      };
      const response = edit
        ? await dataOf(api.put(`/assets/${assetId}`, body))
        : await dataOf(api.post("/assets", body));
      toast.success(edit ? "Asset updated" : "Asset created");
      navigate(`/assets/${response.assetId}`);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not save asset");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={edit ? `/assets/${assetId}` : "/assets"}>
        <ArrowLeft size={15} /> Back
      </Link>
      <PageHeader
        eyebrow={edit ? "Asset editor" : "Asset register"}
        title={edit ? `Edit ${assetId}` : "Add asset"}
      />
      <form className="panel asset-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Asset ID
            <input
              required
              disabled={edit}
              value={form.assetId}
              onChange={(event) => set("assetId", event.target.value)}
            />
          </label>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </label>
          <label>
            Asset type
            <select
              required
              disabled={edit}
              value={form.typeKey}
              onChange={(event) => {
                const selected = types.data.find(
                  (item) => item.key === event.target.value,
                );
                setForm((current) => ({
                  ...current,
                  typeKey: event.target.value,
                  sector: selected?.sector || current.sector,
                  expectedUsefulLifeYears:
                    selected?.defaultUsefulLifeYears ||
                    current.expectedUsefulLifeYears,
                  attributes: {},
                }));
              }}
            >
              <option value="">Select type</option>
              {types.data.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} ({item.key})
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <input
              value={form.sector}
              onChange={(event) => set("sector", event.target.value)}
            />
          </label>
          <label>
            Constructed on
            <input
              type="date"
              value={form.constructedOn}
              onChange={(event) => set("constructedOn", event.target.value)}
            />
          </label>
          <label>
            Useful life years
            <input
              type="number"
              min="1"
              value={form.expectedUsefulLifeYears}
              onChange={(event) =>
                set("expectedUsefulLifeYears", event.target.value)
              }
            />
          </label>
          <label>
            Criticality
            <input
              type="number"
              min="0"
              max="100"
              value={form.criticality}
              onChange={(event) => set("criticality", event.target.value)}
            />
          </label>
          <label>
            Traffic importance
            <input
              type="number"
              min="0"
              max="100"
              value={form.trafficImportance}
              onChange={(event) => set("trafficImportance", event.target.value)}
            />
          </label>
          <label>
            Failure history
            <input
              type="number"
              min="0"
              value={form.failureHistoryCount}
              onChange={(event) =>
                set("failureHistoryCount", event.target.value)
              }
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(event) => set("latitude", event.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(event) => set("longitude", event.target.value)}
            />
          </label>
        </div>
        {type && (
          <>
            <div className="panel-heading">
              <span>
                <small>Dynamic schema</small>
                <h2>{type.label} attributes</h2>
              </span>
              <Badge>{type.key}</Badge>
            </div>
            <div className="attribute-grid">
              {type.attributeSchema?.map((field) => (
                <label className="dynamic-field" key={field.key}>
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                  {field.type === "boolean" ? (
                    <select
                      value={String(form.attributes[field.key] ?? "false")}
                      onChange={(event) =>
                        setAttribute(field.key, event.target.value, field.type)
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={form.attributes[field.key] ?? ""}
                      onChange={(event) =>
                        setAttribute(field.key, event.target.value, field.type)
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          </>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : edit ? "Save changes" : "Create asset"}
          </button>
        </div>
      </form>
    </>
  );
}
