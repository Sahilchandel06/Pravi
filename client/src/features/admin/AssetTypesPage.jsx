import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, dataOf } from "../../lib/api";
import { Badge, Empty, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";
import RiskConfigPanel from "./RiskConfigPanel";

const blankAttribute = { key: "", label: "", type: "string", unit: "" };
const blankComponent = { childTypeKey: "", name: "", conditionWeight: "0.1" };
const blankRelationship = { type: "CONTAINS", toTypeKey: "" };
const initial = {
  key: "",
  label: "",
  sector: "",
  isComponent: false,
  defaultUsefulLifeYears: "25",
  inspectionIntervalMonths: "12",
  attributeSchema: [{ ...blankAttribute }],
  componentTemplates: [{ ...blankComponent }],
  allowedRelationships: [{ ...blankRelationship }],
};

export default function AssetTypesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState(initial);
  const query = useQuery({
    queryKey: ["asset-types"],
    queryFn: () => dataOf(api.get("/asset-types")),
  });
  const create = useMutation({
    mutationFn: (body) => dataOf(api.post("/asset-types", body)),
    onSuccess: () => {
      toast.success("Asset type created");
      setForm(initial);
      client.invalidateQueries({ queryKey: ["asset-types"] });
    },
    onError: (error) =>
      toast.error(error.response?.data?.error || "Could not create asset type"),
  });
  const reset = useMutation({
    mutationFn: () => dataOf(api.post("/admin/reset-demo")),
    onSuccess: (data) => {
      toast.success("Demo data reset");
      window.alert(data.output);
    },
    onError: (error) =>
      toast.error(error.response?.data?.error || "Could not reset demo data"),
  });
  const updateRow = (group, index, key, value) =>
    setForm({
      ...form,
      [group]: form[group].map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    });
  function submit(event) {
    event.preventDefault();
    create.mutate({
      ...form,
      defaultUsefulLifeYears: Number(form.defaultUsefulLifeYears),
      inspectionIntervalMonths: Number(form.inspectionIntervalMonths),
      attributeSchema: form.attributeSchema.filter(
        (row) => row.key && row.label,
      ),
      componentTemplates: form.componentTemplates
        .filter((row) => row.childTypeKey && row.name)
        .map((row) => ({
          ...row,
          conditionWeight: Number(row.conditionWeight),
        })),
      allowedRelationships: form.allowedRelationships.filter(
        (row) => row.toTypeKey,
      ),
    });
  }
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Asset types"
        action={
          <button
            className="danger-button"
            onClick={() => {
              if (window.confirm("Reset all demo data?")) reset.mutate();
            }}
            disabled={reset.isPending}
          >
            Reset demo data
          </button>
        }
      />
      <RiskConfigPanel />
      <div className="admin-grid">
        <section className="panel">
          <div className="panel-heading">
            <span>
              <small>Registered schemas</small>
              <h2>AssetType records</h2>
            </span>
          </div>
          {query.data.length ? (
            query.data.map((type) => (
              <div className="request-row" key={type.key}>
                <span>
                  <b>{type.label}</b>
                  <small>
                    {type.key} · {type.sector} ·{" "}
                    {type.attributeSchema?.length || 0} attributes
                  </small>
                </span>
                <Badge>{type.isComponent ? "COMPONENT" : "ASSET"}</Badge>
              </div>
            ))
          ) : (
            <Empty />
          )}
        </section>
        <form className="panel admin-form" onSubmit={submit}>
          <div className="panel-heading">
            <span>
              <small>Schema builder</small>
              <h2>Create asset type</h2>
            </span>
          </div>
          <div className="form-grid">
            <label>
              Key
              <input
                required
                pattern="[a-z][a-z0-9_]*"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="water_pipeline"
              />
            </label>
            <label>
              Label
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Water pipeline"
              />
            </label>
            <label>
              Sector
              <input
                required
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="water"
              />
            </label>
            <label>
              Useful life years
              <input
                type="number"
                min="1"
                value={form.defaultUsefulLifeYears}
                onChange={(e) =>
                  setForm({ ...form, defaultUsefulLifeYears: e.target.value })
                }
              />
            </label>
            <label>
              Inspection interval months
              <input
                type="number"
                min="1"
                value={form.inspectionIntervalMonths}
                onChange={(e) =>
                  setForm({ ...form, inspectionIntervalMonths: e.target.value })
                }
              />
            </label>
          </div>
          <h3>Attribute schema</h3>
          {form.attributeSchema.map((row, index) => (
            <div className="admin-row" key={index}>
              <input
                placeholder="key"
                value={row.key}
                onChange={(e) =>
                  updateRow("attributeSchema", index, "key", e.target.value)
                }
              />
              <input
                placeholder="Label"
                value={row.label}
                onChange={(e) =>
                  updateRow("attributeSchema", index, "label", e.target.value)
                }
              />
              <select
                value={row.type}
                onChange={(e) =>
                  updateRow("attributeSchema", index, "type", e.target.value)
                }
              >
                <option>string</option>
                <option>number</option>
                <option>boolean</option>
              </select>
              <input
                placeholder="unit"
                value={row.unit}
                onChange={(e) =>
                  updateRow("attributeSchema", index, "unit", e.target.value)
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setForm({
                ...form,
                attributeSchema: [
                  ...form.attributeSchema,
                  { ...blankAttribute },
                ],
              })
            }
          >
            + Attribute row
          </button>
          <h3>Component templates</h3>
          {form.componentTemplates.map((row, index) => (
            <div className="admin-row" key={index}>
              <input
                placeholder="child type key"
                value={row.childTypeKey}
                onChange={(e) =>
                  updateRow(
                    "componentTemplates",
                    index,
                    "childTypeKey",
                    e.target.value,
                  )
                }
              />
              <input
                placeholder="Name"
                value={row.name}
                onChange={(e) =>
                  updateRow("componentTemplates", index, "name", e.target.value)
                }
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                placeholder="Weight"
                value={row.conditionWeight}
                onChange={(e) =>
                  updateRow(
                    "componentTemplates",
                    index,
                    "conditionWeight",
                    e.target.value,
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setForm({
                ...form,
                componentTemplates: [
                  ...form.componentTemplates,
                  { ...blankComponent },
                ],
              })
            }
          >
            + Component row
          </button>
          <h3>Allowed relationships</h3>
          {form.allowedRelationships.map((row, index) => (
            <div className="admin-row" key={index}>
              <select
                value={row.type}
                onChange={(e) =>
                  updateRow(
                    "allowedRelationships",
                    index,
                    "type",
                    e.target.value,
                  )
                }
              >
                <option>CONTAINS</option>
                <option>DEPENDS_ON</option>
                <option>CONNECTS_TO</option>
                <option>DRAINS_TO</option>
              </select>
              <input
                placeholder="target type key"
                value={row.toTypeKey}
                onChange={(e) =>
                  updateRow(
                    "allowedRelationships",
                    index,
                    "toTypeKey",
                    e.target.value,
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setForm({
                ...form,
                allowedRelationships: [
                  ...form.allowedRelationships,
                  { ...blankRelationship },
                ],
              })
            }
          >
            + Relationship row
          </button>
          <button className="primary-button" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create asset type"}
          </button>
        </form>
      </div>
    </>
  );
}
