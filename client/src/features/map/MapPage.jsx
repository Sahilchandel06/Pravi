import { useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, dataOf } from "../../lib/api";
import { Badge, Empty, ErrorState, Loading } from "../../components/States";
import { PageHeader } from "../dashboard/Dashboard";
import "leaflet/dist/leaflet.css";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const lineColor = {
  HEALTHY: "#2f6b4f",
  ATTENTION: "#d99b3d",
  CRITICAL: "#c85a48",
  UNDER_MAINTENANCE: "#5578a8",
};
export default function MapPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["geojson"],
    queryFn: () => dataOf(api.get("/assets/geojson")),
  });
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState(null);
  const features = useMemo(
    () =>
      data?.features?.filter(
        (feature) => type === "all" || feature.properties.typeKey === type,
      ) || [],
    [data, type],
  );
  if (isLoading) return <Loading label="Loading spatial register..." />;
  if (error) return <ErrorState error={error} />;
  const types = [
    ...new Set(data.features.map((feature) => feature.properties.typeKey)),
  ];
  return (
    <>
      <PageHeader
        eyebrow="Spatial register"
        title="Asset map"
        action={
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        }
      />
      <div className="map-layout">
        <div className="map-canvas">
          <MapContainer center={[22.65, 72.95]} zoom={9} scrollWheelZoom>
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {features.map((feature) =>
              feature.geometry.type === "Point" ? (
                <Marker
                  key={feature.properties.assetId}
                  icon={icon}
                  position={[
                    feature.geometry.coordinates[1],
                    feature.geometry.coordinates[0],
                  ]}
                  eventHandlers={{
                    click: () => setSelected(feature.properties),
                  }}
                />
              ) : (
                <Polyline
                  key={feature.properties.assetId}
                  positions={feature.geometry.coordinates.map(([lng, lat]) => [
                    lat,
                    lng,
                  ])}
                  pathOptions={{
                    color: lineColor[feature.properties.status] || "#5578a8",
                    weight: 5,
                  }}
                  eventHandlers={{
                    click: () => setSelected(feature.properties),
                  }}
                />
              ),
            )}
          </MapContainer>
        </div>
        {selected ? (
          <aside className="drawer">
            <button className="close-button" onClick={() => setSelected(null)}>
              ×
            </button>
            <p className="eyebrow">Selected asset</p>
            <h2>{selected.name}</h2>
            <p className="mono">{selected.assetId}</p>
            <dl>
              <dt>Type</dt>
              <dd>{selected.typeKey}</dd>
              <dt>Condition</dt>
              <dd>{selected.condition?.score ?? "-"}/100</dd>
              <dt>Risk</dt>
              <dd>
                <Badge>{selected.riskLevel || "UNASSESSED"}</Badge>
              </dd>
              <dt>Status</dt>
              <dd>
                <Badge>{selected.status}</Badge>
              </dd>
            </dl>
            <Link
              className="primary-button block"
              to={`/assets/${selected.assetId}`}
            >
              Open profile
            </Link>
            <Link
              className="secondary-button block"
              to={`/graph/${selected.assetId}`}
            >
              View dependencies
            </Link>
          </aside>
        ) : (
          <div className="map-note">
            <b>{features.length}</b> mapped assets
            <br />
            <small>Click a marker or line to inspect the register.</small>
          </div>
        )}
      </div>
    </>
  );
}
