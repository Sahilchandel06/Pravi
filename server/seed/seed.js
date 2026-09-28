import bcrypt from "bcryptjs";
import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config.js";
import { conditionService, riskService } from "../src/services/index.js";
import {
  User,
  AssetType,
  Asset,
  AssetRelationship,
  Inspection,
  RiskAssessment,
  LifecycleEvent,
  MaintenanceRecord,
  MaintenanceRequest,
  WorkOrder,
  Counter,
  AuditLog,
  RiskConfig,
} from "../src/models.js";

const point = (lat, lng) => ({ type: "Point", coordinates: [lng, lat] });
const line = (a, b) => ({ type: "LineString", coordinates: [a, b] });
const componentTemplates = [
  ["deck", "Deck", 0.3],
  ["bearings", "Bearings", 0.2],
  ["expansion_joint", "Expansion Joint", 0.25],
  ["drainage", "Drainage", 0.15],
  ["guardrail", "Guardrail", 0.1],
].map(([childTypeKey, name, conditionWeight]) => ({
  childTypeKey,
  name,
  conditionWeight,
}));
const typeData = [
  ["highway", "Highway", false],
  ["road_segment", "Road segment", false],
  ["bridge", "Bridge", false],
  ["tunnel", "Tunnel", false],
  ["culvert", "Culvert", false],
  ["deck", "Deck", true],
  ["bearings", "Bearings", true],
  ["expansion_joint", "Expansion joint", true],
  ["drainage", "Drainage", true],
  ["guardrail", "Guardrail", true],
  ["road_sign", "Road sign", true],
  ["streetlight", "Streetlight", true],
];
const roleFor = (name) =>
  ({
    admin: "ADMIN",
    manager: "MANAGER",
    inspector: "INSPECTOR",
    maintenance: "MAINTENANCE",
  })[name];

async function run() {
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    AssetType.deleteMany({}),
    Asset.deleteMany({}),
    AssetRelationship.deleteMany({}),
    Inspection.deleteMany({}),
    RiskAssessment.deleteMany({}),
    LifecycleEvent.deleteMany({}),
    MaintenanceRecord.deleteMany({}),
    MaintenanceRequest.deleteMany({}),
    WorkOrder.deleteMany({}),
    AuditLog.deleteMany({}),
    RiskConfig.deleteMany({}),
    Counter.deleteMany({}),
  ]);
  const passwordHash = await bcrypt.hash("Passw0rd!", 10);
  const users = await User.insertMany(
    ["admin", "manager", "inspector", "maintenance"].map((name) => ({
      name,
      email: `${name}@infralife.gov`,
      role: roleFor(name),
      passwordHash,
    })),
  );
  const relationship = (type, toTypeKey) => ({ type, toTypeKey });
  await AssetType.insertMany(
    typeData.map(([key, label, isComponent]) => ({
      key,
      label,
      sector: "roads",
      isComponent,
      defaultUsefulLifeYears: key === "bridge" ? 80 : 25,
      inspectionIntervalMonths: key === "bridge" ? 6 : 12,
      componentTemplates: key === "bridge" ? componentTemplates : [],
      attributeSchema:
        key === "bridge"
          ? [
              { key: "bridgeType", label: "Bridge type", type: "string" },
              { key: "lengthM", label: "Length", type: "number", unit: "m" },
              { key: "widthM", label: "Width", type: "number", unit: "m" },
              { key: "lanes", label: "Lanes", type: "number" },
              {
                key: "loadCapacityTonnes",
                label: "Load capacity",
                type: "number",
                unit: "t",
              },
              { key: "material", label: "Material", type: "string" },
            ]
          : key === "road_segment"
            ? [
                { key: "roadType", label: "Road type", type: "string" },
                {
                  key: "lengthKm",
                  label: "Length",
                  type: "number",
                  unit: "km",
                },
                { key: "lanes", label: "Lanes", type: "number" },
                { key: "surfaceType", label: "Surface", type: "string" },
              ]
            : [],
      allowedRelationships:
        key === "highway"
          ? [relationship("CONTAINS", "road_segment")]
          : key === "road_segment"
            ? [
                relationship("CONTAINS", "bridge"),
                relationship("CONTAINS", "tunnel"),
                relationship("CONTAINS", "culvert"),
                relationship("DEPENDS_ON", "guardrail"),
                relationship("DEPENDS_ON", "road_sign"),
                relationship("DEPENDS_ON", "streetlight"),
                relationship("CONNECTS_TO", "road_segment"),
              ]
            : key === "bridge"
              ? componentTemplates
                  .map(({ childTypeKey }) =>
                    relationship("CONTAINS", childTypeKey),
                  )
                  .concat(relationship("DEPENDS_ON", "drainage"))
              : key === "culvert"
                ? [relationship("DRAINS_TO", "road_segment")]
                : key === "road_sign" ||
                    key === "streetlight" ||
                    key === "guardrail"
                  ? [relationship("DEPENDS_ON", "road_segment")]
                  : [],
    })),
  );
  const assets = [];
  const add = (assetId, name, typeKey, location, options = {}) =>
    assets.push({
      assetId,
      name,
      typeKey,
      sector: "roads",
      location,
      constructedOn: new Date(options.constructedOn || "2018-01-01"),
      expectedUsefulLifeYears: options.expectedUsefulLifeYears || 25,
      condition: {
        score: options.score ?? 82,
        rating: options.status || "HEALTHY",
        lastAssessedAt: new Date(options.lastAssessedAt || "2026-02-10"),
      },
      criticality: options.criticality ?? 60,
      trafficImportance: options.trafficImportance ?? 70,
      failureHistoryCount: options.failureHistoryCount ?? 0,
      lifecycleStage: options.lifecycleStage || "OPERATIONAL",
      status: options.status || "HEALTHY",
      nextInspectionDue: new Date(options.nextInspectionDue || "2027-01-01"),
      attributes: options.attributes || {},
      dependencySegment: options.dependencySegment,
    });
  add(
    "NH-XX",
    "NH-48 Ahmedabad Vadodara",
    "highway",
    line([72.7, 22.4], [73.2, 22.8]),
    { criticality: 88, trafficImportance: 96 },
  );
  add(
    "RS-202",
    "Road segment 202",
    "road_segment",
    line([72.8, 22.5], [72.88, 22.58]),
    {
      attributes: {
        roadType: "National highway",
        lengthKm: 12,
        lanes: 6,
        surfaceType: "Bitumen",
      },
    },
  );
  add(
    "RS-201",
    "Road segment 201",
    "road_segment",
    line([72.72, 22.42], [72.8, 22.5]),
    {
      attributes: {
        roadType: "National highway",
        lengthKm: 11,
        lanes: 6,
        surfaceType: "Bitumen",
      },
    },
  );
  add(
    "RS-203",
    "Road segment 203",
    "road_segment",
    line([72.88, 22.58], [72.98, 22.68]),
    {
      attributes: {
        roadType: "National highway",
        lengthKm: 14,
        lanes: 6,
        surfaceType: "Bitumen",
      },
      status: "ATTENTION",
      score: 72,
    },
  );
  add(
    "RS-204",
    "Road segment 204",
    "road_segment",
    line([72.98, 22.68], [73.08, 22.76]),
    {
      attributes: {
        roadType: "National highway",
        lengthKm: 13,
        lanes: 6,
        surfaceType: "Bitumen",
      },
    },
  );
  add(
    "RS-205",
    "Road segment 205",
    "road_segment",
    line([73.08, 22.76], [73.18, 22.84]),
    {
      attributes: {
        roadType: "National highway",
        lengthKm: 15,
        lanes: 6,
        surfaceType: "Bitumen",
      },
    },
  );
  add("BR-101", "Mahi river bridge", "bridge", point(22.61, 72.91));
  add("BR-102", "Nadiad interchange bridge", "bridge", point(22.69, 72.86), {
    score: 64,
    criticality: 91,
    trafficImportance: 94,
    failureHistoryCount: 2,
    nextInspectionDue: "2026-01-01",
    attributes: {
      bridgeType: "Prestressed concrete",
      lengthM: 240,
      widthM: 28,
      lanes: 6,
      loadCapacityTonnes: 120,
      material: "Concrete",
    },
  });
  add("BR-103", "Vadodara overpass", "bridge", point(22.73, 72.98));
  add("BR-104", "Anand bypass bridge", "bridge", point(22.78, 73.04), {
    criticality: 78,
    trafficImportance: 86,
    score: 76,
  });
  add("CV-07", "Culvert 07", "culvert", point(22.65, 72.84));
  add("CV-08", "Culvert 08", "culvert", point(22.52, 72.76));
  add("CV-09", "Culvert 09", "culvert", point(22.82, 73.12));
  add("TN-014", "Vadodara approach tunnel", "tunnel", point(22.76, 73.08), {
    lifecycleStage: "UNDER_MAINTENANCE",
    status: "UNDER_MAINTENANCE",
  });
  for (const [assetId, name, typeKey, score] of [
    ["DE-102", "Deck BR-102", "deck", 82],
    ["BE-102", "Bearings BR-102", "bearings", 61],
    ["EJ-102", "Expansion Joint BR-102", "expansion_joint", 43],
    ["DR-102", "Drainage BR-102", "drainage", 67],
    ["GR-102", "Guardrail BR-102", "guardrail", 88],
  ])
    add(assetId, name, typeKey, point(22.69, 72.86), {
      score,
      criticality: 91,
      trafficImportance: 94,
    });
  for (const [assetId, name, segment] of [
    ["GR-201", "Guardrail RS-201", "RS-201"],
    ["GR-203", "Guardrail RS-203", "RS-203"],
    ["GR-204", "Guardrail RS-204", "RS-204"],
    ["GR-205", "Guardrail RS-205", "RS-205"],
  ])
    add(assetId, name, "guardrail", point(22.7, 72.9), {
      score: 82,
      dependencySegment: segment,
    });
  for (let index = 1; index <= 6; index += 1) {
    const segment = [
      "RS-201",
      "RS-202",
      "RS-203",
      "RS-204",
      "RS-205",
      "RS-203",
    ][index - 1];
    add(
      `SG-${String(index).padStart(2, "0")}`,
      `Road sign ${index}`,
      "road_sign",
      point(22.55 + index * 0.03, 72.78 + index * 0.04),
      { score: 88, dependencySegment: segment },
    );
  }
  for (let index = 1; index <= 6; index += 1) {
    const segment = [
      "RS-201",
      "RS-202",
      "RS-203",
      "RS-204",
      "RS-205",
      "RS-203",
    ][index - 1];
    add(
      `SL-${String(index).padStart(2, "0")}`,
      `Streetlight ${index}`,
      "streetlight",
      point(22.55 + index * 0.03, 72.78 + index * 0.04),
      { score: 90, dependencySegment: segment },
    );
  }
  const inserted = await Asset.insertMany(assets);
  const byId = Object.fromEntries(
    inserted.map((asset) => [asset.assetId, asset]),
  );
  const contains = async (from, to, type = "CONTAINS", weight = 1) => {
    byId[to].parent = byId[from]._id;
    await byId[to].save();
    return AssetRelationship.create({
      from: byId[from]._id,
      to: byId[to]._id,
      type,
      weight,
    });
  };
  await Promise.all([
    contains("NH-XX", "RS-202"),
    contains("NH-XX", "RS-201"),
    contains("NH-XX", "RS-203"),
    contains("NH-XX", "RS-204"),
    contains("NH-XX", "RS-205"),
    contains("RS-203", "BR-102"),
    contains("RS-204", "BR-104"),
    contains("RS-201", "CV-08"),
    contains("RS-205", "CV-09"),
    contains("BR-102", "DE-102", "CONTAINS", 0.3),
    contains("BR-102", "BE-102", "CONTAINS", 0.2),
    contains("BR-102", "EJ-102", "CONTAINS", 0.25),
    contains("BR-102", "DR-102", "CONTAINS", 0.15),
    contains("BR-102", "GR-102", "CONTAINS", 0.1),
    AssetRelationship.create({
      from: byId["BR-102"]._id,
      to: byId["DR-102"]._id,
      type: "DEPENDS_ON",
      weight: 0.7,
    }),
    AssetRelationship.create({
      from: byId["CV-07"]._id,
      to: byId["RS-203"]._id,
      type: "DRAINS_TO",
      weight: 0.6,
    }),
    AssetRelationship.create({
      from: byId["RS-202"]._id,
      to: byId["RS-203"]._id,
      type: "CONNECTS_TO",
      weight: 0.5,
    }),
    ...assets
      .filter((asset) => asset.dependencySegment)
      .map((asset) =>
        AssetRelationship.create({
          from: byId[asset.assetId]._id,
          to: byId[asset.dependencySegment]._id,
          type: "DEPENDS_ON",
          weight: 0.4,
        }),
      ),
    AssetRelationship.create({
      from: byId["RS-203"]._id,
      to: byId["RS-204"]._id,
      type: "CONNECTS_TO",
      weight: 0.5,
    }),
  ]);
  const inspector = users.find((user) => user.role === "INSPECTOR");
  await Inspection.insertMany([
    {
      asset: byId["BR-102"]._id,
      inspector: inspector._id,
      date: new Date("2025-06-10"),
      results: [{ component: "bridge", rating: 71, notes: "Prior inspection" }],
      observations: "Routine bridge survey",
      conditionBefore: 74,
      conditionAfter: 71,
    },
    {
      asset: byId["BR-102"]._id,
      inspector: inspector._id,
      date: new Date("2026-02-10"),
      results: [
        { component: "bridge", rating: 64, notes: "Detailed condition survey" },
      ],
      observations: "Expansion joint deterioration observed",
      conditionBefore: 71,
      conditionAfter: 64,
    },
  ]);
  await MaintenanceRecord.insertMany(
    [
      [2023, 420000],
      [2024, 510000],
      [2025, 780000],
      [2026, 1030000],
    ].map(([year, cost]) => ({ asset: byId["BR-102"]._id, year, cost })),
  );
  await LifecycleEvent.insertMany(
    [
      [2018, "Construction"],
      [2019, "Commissioned"],
      [2021, "Inspection"],
      [2023, "Repair"],
      [2025, "Major Inspection"],
      [2026, "Condition Assessment"],
      [2026, "Maintenance Required"],
    ].map(([year, title]) => ({
      asset: byId["BR-102"]._id,
      type: "MILESTONE",
      title,
      date: new Date(`${year}-06-01`),
    })),
  );
  await Counter.create({ _id: "workOrder", seq: 1041 });
  await conditionService.recomputeAll();
  await riskService.recomputeAll();
  console.log(
    `Seeded users=${await User.countDocuments()} types=${await AssetType.countDocuments()} assets=${await Asset.countDocuments()} relationships=${await AssetRelationship.countDocuments()} inspections=${await Inspection.countDocuments()} lifecycleEvents=${await LifecycleEvent.countDocuments()} maintenanceRecords=${await MaintenanceRecord.countDocuments()}`,
  );
  console.log(
    "Login users: admin@infralife.gov, manager@infralife.gov, inspector@infralife.gov, maintenance@infralife.gov / Passw0rd!",
  );
  await mongoose.disconnect();
}
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
