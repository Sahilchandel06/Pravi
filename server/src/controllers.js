import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  User,
  Asset,
  AssetType,
  Inspection,
  RiskAssessment,
  AssetRelationship,
  WorkOrder,
  MaintenanceRecord,
  MaintenanceRequest,
  Document,
  RiskConfig,
  AuditLog,
} from "./models.js";
import { config } from "./config.js";
import { RISK_WEIGHTS } from "./config/risk.js";
import { audit } from "./services.js";
import {
  conditionService,
  graphService,
  riskService,
  inspectionService,
  maintenanceService,
} from "./services/index.js";
import { chat as assistantChat } from "./services/assistantService.js";
import { adminService } from "./services/index.js";
import {
  uploadBuffer,
  destroy as destroyCloudinary,
} from "./services/cloudinaryService.js";
import { ok } from "./middleware.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const inspectionSchema = z.object({
  date: z.coerce.date().optional(),
  results: z
    .array(
      z.object({
        component: z.string(),
        rating: z.number().min(0).max(100),
        notes: z.string().optional(),
      }),
    )
    .default([]),
  observations: z.string().optional(),
  photos: z.array(z.string().url()).default([]),
  conditionAfter: z.number().min(0).max(100),
});
const assetSchema = z.object({
  assetId: z.string().min(1),
  name: z.string().min(1),
  typeKey: z.string(),
  sector: z.string().default("roads"),
  parent: z.string().optional(),
  location: z.object({
    type: z.enum(["Point", "LineString", "Polygon"]),
    coordinates: z.array(z.any()),
  }),
  attributes: z.record(z.any()).default({}),
  constructedOn: z.coerce.date().optional(),
  expectedUsefulLifeYears: z.number().positive().optional(),
  criticality: z.number().min(0).max(100).default(50),
  trafficImportance: z.number().min(0).max(100).default(50),
  failureHistoryCount: z.number().min(0).default(0),
  lifecycleStage: z
    .enum(["OPERATIONAL", "UNDER_MAINTENANCE", "REHABILITATION"])
    .default("OPERATIONAL"),
});

const fail = (message, status = 404) => {
  throw Object.assign(new Error(message), { status });
};
const latestRisks = async (assets) => {
  const rows = await RiskAssessment.find({
    asset: { $in: assets.map((item) => item._id) },
  })
    .sort({ computedAt: -1 })
    .lean();
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(String(row.asset))) map.set(String(row.asset), row);
  });
  return map;
};
const serializeAsset = (asset, risks) => ({
  ...asset,
  riskLevel: risks?.get(String(asset._id))?.level || null,
  risk: risks?.get(String(asset._id)) || null,
});

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res
      .status(401)
      .json({ success: false, error: "Invalid credentials" });
  ok(res, {
    token: jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      config.jwt,
      { expiresIn: "8h" },
    ),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}
export async function me(req, res) {
  ok(res, await User.findById(req.user.id).select("-passwordHash"));
}
export async function uploadFile(req, res) {
  if (!req.file)
    return res.status(400).json({
      success: false,
      error: "A supported image or PDF file is required",
    });
  const result = await uploadBuffer(req.file.buffer, { resource_type: "auto" });
  ok(res, {
    name: req.file.originalname,
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
  });
}
export async function createDocument(req, res) {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, error: "A document file is required" });
  const asset = await Asset.findOne({ assetId: req.body.assetId });
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const result = await uploadBuffer(req.file.buffer, { resource_type: "auto" });
  const document = await Document.create({
    asset: asset._id,
    name: req.body.name || req.file.originalname,
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    uploadedBy: req.user.id,
  });
  await audit(
    req.user.id,
    "CREATE",
    "Document",
    document._id,
    null,
    document.toObject(),
  );
  ok(res, document, 201);
}
export async function listDocuments(req, res) {
  const filter = {};
  if (req.query.assetId) {
    const asset = await Asset.findOne({ assetId: req.query.assetId });
    if (!asset) return ok(res, []);
    filter.asset = asset._id;
  }
  ok(
    res,
    await Document.find(filter)
      .sort({ createdAt: -1 })
      .populate("asset", "assetId name")
      .lean(),
  );
}
export async function deleteDocument(req, res) {
  const document = await Document.findById(req.params.id);
  if (!document)
    return res
      .status(404)
      .json({ success: false, error: "Document not found" });
  await destroyCloudinary(
    document.publicId,
    document.resourceType === "raw" ? "raw" : "image",
  );
  await Document.deleteOne({ _id: document._id });
  await audit(
    req.user.id,
    "DELETE",
    "Document",
    document._id,
    document.toObject(),
    null,
  );
  ok(res, document);
}
export async function listTypes(req, res) {
  ok(res, await AssetType.find().sort({ sector: 1, key: 1 }).lean());
}
export async function listAudit(req, res) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const filter = {};
  if (req.query.entityId) {
    if (!/^[a-f\d]{24}$/i.test(req.query.entityId))
      return res
        .status(400)
        .json({ success: false, error: "Invalid entityId" });
    const id = new mongoose.Types.ObjectId(req.query.entityId);
    const asset = await Asset.findById(id).select("assetId").lean();
    filter.$or = [
      { entityId: id },
      { "before.asset": id },
      { "after.asset": id },
      ...(asset
        ? [
            { "before.assetId": asset.assetId },
            { "after.assetId": asset.assetId },
          ]
        : []),
    ];
  }
  ok(
    res,
    await AuditLog.find(filter)
      .sort({ at: -1 })
      .limit(limit)
      .populate("user", "name email role")
      .lean(),
  );
}
export async function getRiskConfig(req, res) {
  const config = await RiskConfig.findOne({ key: "global" }).lean();
  ok(res, {
    weights: config?.weights || RISK_WEIGHTS,
    updatedAt: config?.updatedAt || null,
    updatedBy: config?.updatedBy || null,
  });
}
export async function updateRiskConfig(req, res) {
  const schema = z.object({
    weights: z.object({
      condition: z.number().min(0).max(1),
      criticality: z.number().min(0).max(1),
      traffic: z.number().min(0).max(1),
      age: z.number().min(0).max(1),
      failureHistory: z.number().min(0).max(1),
      inspectionStatus: z.number().min(0).max(1),
      dependencyImpact: z.number().min(0).max(1),
    }),
  });
  const data = schema.parse(req.body);
  const total = Object.values(data.weights).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (total <= 0)
    return res.status(400).json({
      success: false,
      error: "At least one weight must be greater than zero",
    });
  const before = await RiskConfig.findOne({ key: "global" }).lean();
  const item = await RiskConfig.findOneAndUpdate(
    { key: "global" },
    {
      key: "global",
      weights: data.weights,
      updatedBy: req.user.id,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await audit(
    req.user.id,
    "UPDATE",
    "RiskConfig",
    item._id,
    before,
    item.toObject(),
  );
  ok(res, item);
}
export async function recomputeRisks(req, res) {
  const count = await riskService.recomputeAll();
  ok(res, { message: "Risk assessments recomputed", count });
}

const assetTypeSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  sector: z.string().min(1),
  isComponent: z.boolean().default(false),
  attributeSchema: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.string().min(1),
        unit: z.string().optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .default([]),
  componentTemplates: z
    .array(
      z.object({
        childTypeKey: z.string().min(1),
        name: z.string().min(1),
        conditionWeight: z.number().min(0).max(1),
      }),
    )
    .default([]),
  defaultUsefulLifeYears: z.number().positive(),
  inspectionIntervalMonths: z.number().positive(),
  allowedRelationships: z
    .array(
      z.object({
        type: z.enum(["CONTAINS", "DEPENDS_ON", "CONNECTS_TO", "DRAINS_TO"]),
        toTypeKey: z.string().min(1),
      }),
    )
    .default([]),
});
export async function createAssetType(req, res) {
  const data = assetTypeSchema.parse(req.body);
  if (await AssetType.exists({ key: data.key }))
    return res
      .status(409)
      .json({ success: false, error: "Asset type key already exists" });
  const item = await AssetType.create(data);
  await audit(
    req.user.id,
    "CREATE",
    "AssetType",
    item._id,
    null,
    item.toObject(),
  );
  ok(res, item, 201);
}
export async function updateAssetType(req, res) {
  const data = assetTypeSchema.partial().parse(req.body);
  const before = await AssetType.findOne({ key: req.params.key });
  if (!before)
    return res
      .status(404)
      .json({ success: false, error: "Asset type not found" });
  const item = await AssetType.findOneAndUpdate(
    { key: req.params.key },
    { $set: data },
    { new: true, runValidators: true },
  );
  await audit(
    req.user.id,
    "UPDATE",
    "AssetType",
    item._id,
    before.toObject(),
    item.toObject(),
  );
  ok(res, item);
}
export async function resetDemo(req, res) {
  ok(res, await adminService.resetDemo());
}

export async function listAssets(req, res) {
  const {
    typeKey,
    status,
    riskLevel,
    q,
    sort = "assetId",
    order = "asc",
  } = req.query;
  const filter = {};
  if (typeKey) filter.typeKey = typeKey;
  if (status) filter.status = status;
  if (q)
    filter.$or = [
      { assetId: new RegExp(q, "i") },
      { name: new RegExp(q, "i") },
    ];
  const all = await Asset.find(filter)
    .sort({ [sort]: order === "desc" ? -1 : 1 })
    .lean();
  const risks = await latestRisks(all);
  let result = all.map((asset) => serializeAsset(asset, risks));
  if (riskLevel)
    result = result.filter((asset) => asset.riskLevel === riskLevel);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
  ok(res, {
    items: result.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: result.length,
    pages: Math.ceil(result.length / limit),
  });
}

export async function geojson(req, res) {
  const assets = await Asset.find({ location: { $exists: true } }).lean();
  const risks = await latestRisks(assets);
  ok(res, {
    type: "FeatureCollection",
    features: assets.map((asset) => ({
      type: "Feature",
      geometry: asset.location,
      properties: {
        assetId: asset.assetId,
        name: asset.name,
        typeKey: asset.typeKey,
        status: asset.status,
        condition: asset.condition,
        riskLevel: risks.get(String(asset._id))?.level || null,
      },
    })),
  });
}
export async function assetQr(req, res) {
  const asset = await Asset.findOne({ assetId: req.params.assetId }).lean();
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const inspectUrl = `${config.clientUrl.replace(/\/$/, "")}/assets/${encodeURIComponent(asset.assetId)}/inspect`;
  ok(res, {
    assetId: asset.assetId,
    url: inspectUrl,
    dataUrl: await QRCode.toDataURL(inspectUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
    }),
  });
}

export async function getAsset(req, res) {
  const asset = await Asset.findOne({ assetId: req.params.assetId }).lean();
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const [type, risks, relationships, inspections, descendants] =
    await Promise.all([
      AssetType.findOne({ key: asset.typeKey }).lean(),
      RiskAssessment.find({ asset: asset._id })
        .sort({ computedAt: -1 })
        .limit(1)
        .lean(),
      AssetRelationship.find({ $or: [{ from: asset._id }, { to: asset._id }] })
        .populate("from to", "assetId name typeKey")
        .lean(),
      Inspection.find({ asset: asset._id }).sort({ date: -1 }).limit(5).lean(),
      Asset.aggregate([
        { $match: { _id: asset._id } },
        {
          $graphLookup: {
            from: "assets",
            startWith: "$_id",
            connectFromField: "_id",
            connectToField: "parent",
            as: "descendants",
            depthField: "depth",
          },
        },
      ]),
    ]);
  const breadcrumb = [];
  let parent = asset.parent;
  while (parent) {
    const item = await Asset.findById(parent)
      .select("assetId name typeKey parent")
      .lean();
    if (!item) break;
    breadcrumb.unshift(item);
    parent = item.parent;
  }
  const tree = (parentId) =>
    (descendants[0]?.descendants || [])
      .filter((item) => String(item.parent) === String(parentId))
      .map((item) => ({ ...item, children: tree(item._id) }));
  ok(res, {
    ...asset,
    type: type?.label,
    attributeSchema: type?.attributeSchema || [],
    latestRisk: risks[0] || null,
    parentBreadcrumb: breadcrumb,
    children: tree(asset._id),
    relationships,
    inspections,
    lastInspectionAt: asset.lastInspectionAt || inspections[0]?.date || null,
    nextInspectionDue: asset.nextInspectionDue,
  });
}

function validateAttributes(type, attributes) {
  for (const field of type.attributeSchema || []) {
    if (attributes[field.key] === undefined) continue;
    if (field.type === "number" && typeof attributes[field.key] !== "number")
      fail(`${field.key} must be a number`, 400);
    if (field.options?.length && !field.options.includes(attributes[field.key]))
      fail(`${field.key} is invalid`, 400);
  }
}
export async function createAsset(req, res) {
  const data = assetSchema.parse(req.body);
  const type = await AssetType.findOne({ key: data.typeKey }).lean();
  if (!type)
    return res
      .status(400)
      .json({ success: false, error: "Unknown asset type" });
  validateAttributes(type, data.attributes);
  if (await Asset.exists({ assetId: data.assetId }))
    return res
      .status(409)
      .json({ success: false, error: "Asset ID already exists" });
  const asset = await Asset.create({
    ...data,
    parent: data.parent,
    expectedUsefulLifeYears:
      data.expectedUsefulLifeYears || type.defaultUsefulLifeYears,
    condition: { score: 85, rating: "GOOD", lastAssessedAt: new Date() },
    status: "HEALTHY",
    nextInspectionDue: new Date(
      Date.now() + type.inspectionIntervalMonths * 2592000000,
    ),
  });
  await audit(
    req.user.id,
    "CREATE",
    "Asset",
    asset._id,
    null,
    asset.toObject(),
  );
  ok(res, asset, 201);
}
export async function updateAsset(req, res) {
  const current = await Asset.findOne({ assetId: req.params.assetId });
  if (!current)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const data = assetSchema.partial().parse(req.body);
  const type = await AssetType.findOne({
    key: data.typeKey || current.typeKey,
  }).lean();
  if (!type)
    return res
      .status(400)
      .json({ success: false, error: "Unknown asset type" });
  if (data.attributes) validateAttributes(type, data.attributes);
  if (
    data.assetId &&
    data.assetId !== current.assetId &&
    (await Asset.exists({ assetId: data.assetId }))
  )
    return res
      .status(409)
      .json({ success: false, error: "Asset ID already exists" });
  const item = await Asset.findOneAndUpdate(
    { _id: current._id },
    { $set: data },
    { new: true, runValidators: true },
  );
  await audit(
    req.user.id,
    "UPDATE",
    "Asset",
    item._id,
    current.toObject(),
    item.toObject(),
  );
  ok(res, item);
}
export async function deleteAsset(req, res) {
  const asset = await Asset.findOne({ assetId: req.params.assetId });
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const [children, relationships] = await Promise.all([
    Asset.countDocuments({ parent: asset._id }),
    AssetRelationship.countDocuments({
      $or: [{ from: asset._id }, { to: asset._id }],
    }),
  ]);
  if (children || relationships)
    return res
      .status(409)
      .json({
        success: false,
        error: "Asset cannot be deleted while it has children or relationships",
      });
  await Asset.deleteOne({ _id: asset._id });
  await audit(
    req.user.id,
    "DELETE",
    "Asset",
    asset._id,
    asset.toObject(),
    null,
  );
  ok(res, asset);
}

export async function createInspection(req, res) {
  const data = inspectionSchema.parse(req.body);
  const asset = await Asset.findOne({ assetId: req.params.assetId });
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const date = data.date || new Date();
  const item = await Inspection.create({
    asset: asset._id,
    inspector: req.user.id,
    conditionBefore: asset.condition?.score,
    ...data,
    date,
  });
  await Asset.updateOne(
    { _id: asset._id },
    {
      $set: {
        "condition.score": data.conditionAfter,
        "condition.rating": conditionService.ratingFor(data.conditionAfter),
        lastInspectionAt: date,
        "condition.lastAssessedAt": date,
      },
    },
  );
  await conditionService.recomputeAsset(await Asset.findById(asset._id).lean());
  await riskService.recompute(await Asset.findById(asset._id).lean());
  await audit(
    req.user.id,
    "CREATE",
    "Inspection",
    item._id,
    null,
    item.toObject(),
  );
  ok(res, item, 201);
}

export async function submitInspection(req, res) {
  const schema = z.object({
    assetId: z.string(),
    results: z.array(
      z.object({
        componentId: z.string(),
        rating: z.union([
          z.number().min(0).max(100),
          z.enum(["GOOD", "MODERATE", "POOR", "CRITICAL"]),
        ]),
        notes: z.string().optional(),
      }),
    ),
    observations: z.string().optional(),
    photos: z.array(z.string().url()).optional(),
  });
  const result = await inspectionService.record(
    schema.parse(req.body),
    req.user.id,
  );
  await audit(
    req.user.id,
    "CREATE",
    "Inspection",
    result.item._id,
    { condition: result.conditionBefore },
    {
      assetId: req.body.assetId,
      condition: result.conditionAfter,
      risk: result.risk,
      createdRequestId: result.createdRequestId,
    },
  );
  ok(res, {
    conditionBefore: result.conditionBefore,
    conditionAfter: result.conditionAfter,
    risk: {
      level: result.risk.level,
      score: result.risk.score,
      reasons: result.risk.reasons,
    },
    recommendedAction: result.recommendedAction,
    createdRequestId: result.createdRequestId,
  });
}

export async function listInspections(req, res) {
  const filter = {};
  if (req.query.assetId) {
    const asset = await Asset.findOne({ assetId: req.query.assetId });
    if (!asset) return ok(res, []);
    filter.asset = asset._id;
  }
  ok(
    res,
    await Inspection.find(filter)
      .sort({ date: -1 })
      .populate("asset", "assetId name")
      .lean(),
  );
}

export async function listMaintenanceRequests(req, res) {
  ok(
    res,
    await MaintenanceRequest.find()
      .sort({ status: 1 })
      .populate("asset", "assetId name")
      .lean(),
  );
}
export async function approveMaintenanceRequest(req, res) {
  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request)
    return res
      .status(404)
      .json({ success: false, error: "Maintenance request not found" });
  const schema = z.object({
    priority: z.string().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    dueDate: z.coerce.date().optional(),
    assignedTeam: z.string().optional(),
  });
  ok(
    res,
    await maintenanceService.approveRequest(
      request,
      schema.parse(req.body),
      req.user.id,
    ),
    201,
  );
}
export async function rejectMaintenanceRequest(req, res) {
  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request)
    return res
      .status(404)
      .json({ success: false, error: "Maintenance request not found" });
  ok(res, await maintenanceService.rejectRequest(request, req.user.id));
}
export async function listWorkOrders(req, res) {
  ok(
    res,
    await WorkOrder.find()
      .sort({ woNumber: -1 })
      .populate("asset", "assetId name")
      .lean(),
  );
}
export async function updateWorkOrderStatus(req, res) {
  const item = await WorkOrder.findById(req.params.id);
  if (!item)
    return res
      .status(404)
      .json({ success: false, error: "Work order not found" });
  const data = z
    .object({
      status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED"]),
      completionEvidence: z.array(z.string().url()).optional(),
    })
    .parse(req.body);
  if (
    ["IN_PROGRESS", "COMPLETED"].includes(data.status) &&
    !["MAINTENANCE", "ADMIN"].includes(req.user.role)
  )
    return res
      .status(403)
      .json({ success: false, error: "Maintenance role required" });
  if (data.status === "CLOSED" && !["MANAGER", "ADMIN"].includes(req.user.role))
    return res
      .status(403)
      .json({ success: false, error: "Manager role required" });
  ok(
    res,
    await maintenanceService.changeStatus(
      item,
      data.status,
      data.completionEvidence,
      req.user.id,
    ),
  );
}
export async function maintenanceCost(req, res) {
  ok(res, await maintenanceService.maintenanceCost(req.params.assetId));
}
export async function lifecycle(req, res) {
  ok(res, await maintenanceService.lifecycle(req.params.assetId));
}
export async function assistant(req, res) {
  const data = z.object({ message: z.string().min(1) }).parse(req.body);
  ok(res, await assistantChat(data.message));
}

export async function dashboardSummary(req, res) {
  const [assets, types, risks, overdue, openWorkOrders, spend] =
    await Promise.all([
      Asset.find().lean(),
      AssetType.find().lean(),
      RiskAssessment.find().sort({ computedAt: -1 }).lean(),
      Asset.countDocuments({ nextInspectionDue: { $lt: new Date() } }),
      WorkOrder.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } }),
      MaintenanceRecord.aggregate([
        { $group: { _id: "$year", total: { $sum: "$cost" } } },
        { $sort: { _id: -1 } },
        { $limit: 4 },
      ]),
    ]);
  const riskMap = new Map();
  risks.forEach((risk) => {
    if (!riskMap.has(String(risk.asset))) riskMap.set(String(risk.asset), risk);
  });
  const byType = assets.reduce((out, item) => {
    out[item.typeKey] = (out[item.typeKey] || 0) + 1;
    return out;
  }, {});
  const byStatus = assets.reduce((out, item) => {
    out[item.status] = (out[item.status] || 0) + 1;
    return out;
  }, {});
  const riskDistribution = assets.reduce((out, item) => {
    const level = riskMap.get(String(item._id))?.level || "LOW";
    out[level] = (out[level] || 0) + 1;
    return out;
  }, {});
  const priority = assets
    .map((item) => ({ ...item, risk: riskMap.get(String(item._id)) }))
    .sort(
      (a, b) =>
        (b.risk?.score || 0) +
        (100 - (b.condition?.score || 0)) -
        ((a.risk?.score || 0) + (100 - (a.condition?.score || 0))),
    )
    .slice(0, 5);
  ok(res, {
    totals: { assets: assets.length, types: types.length },
    byType,
    byStatus,
    riskDistribution,
    averageCondition: assets.length
      ? Math.round(
          assets.reduce((sum, item) => sum + (item.condition?.score || 0), 0) /
            assets.length,
        )
      : 0,
    overdueInspections: overdue,
    openWorkOrders,
    maintenanceSpend: spend.reverse(),
    topPriority: priority.map((item) => ({
      assetId: item.assetId,
      name: item.name,
      score: item.risk?.score || 0,
      riskLevel: item.risk?.level || "LOW",
    })),
  });
}

export async function getRisk(req, res) {
  const asset = await Asset.findOne({ assetId: req.params.assetId });
  if (!asset)
    return res.status(404).json({ success: false, error: "Asset not found" });
  const risk = await riskService.recompute(asset);
  ok(res, { assetId: asset.assetId, ...risk });
}
export async function rankRisk(req, res) {
  const assets = await Asset.find().lean();
  const rows = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      risk: await riskService.calculate(asset),
    })),
  );
  ok(
    res,
    rows
      .sort((a, b) => b.risk.score - a.risk.score)
      .map(({ asset, risk }) => ({
        assetId: asset.assetId,
        name: asset.name,
        typeKey: asset.typeKey,
        ...risk,
      })),
  );
}

export async function createRelationship(req, res) {
  const schema = z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(["CONTAINS", "DEPENDS_ON", "CONNECTS_TO", "DRAINS_TO"]),
    weight: z.number().min(0).max(1).default(1),
  });
  const data = schema.parse(req.body);
  if (data.from === data.to)
    return res
      .status(400)
      .json({ success: false, error: "Self-loops are not allowed" });
  const [from, to] = await Promise.all([
    Asset.findById(data.from),
    Asset.findById(data.to),
  ]);
  if (!from || !to)
    return res.status(404).json({ success: false, error: "Assets not found" });
  const type = await AssetType.findOne({ key: from.typeKey }).lean();
  if (
    !type?.allowedRelationships?.some(
      (item) => item.type === data.type && item.toTypeKey === to.typeKey,
    )
  )
    return res.status(400).json({
      success: false,
      error: "Relationship is not allowed for these asset types",
    });
  if (
    ["CONTAINS", "DEPENDS_ON"].includes(data.type) &&
    (await graphService.wouldCycle(data.from, data.to, data.type))
  )
    return res
      .status(400)
      .json({ success: false, error: "Relationship would create a cycle" });
  const item = await AssetRelationship.create(data);
  if (data.type === "CONTAINS")
    await Asset.updateOne({ _id: to._id }, { $set: { parent: from._id } });
  await audit(
    req.user.id,
    "CREATE",
    "AssetRelationship",
    item._id,
    null,
    item.toObject(),
  );
  await riskService.recompute(from);
  await riskService.recompute(to);
  ok(res, item, 201);
}
export async function deleteRelationship(req, res) {
  const item = await AssetRelationship.findById(req.params.id);
  if (!item)
    return res
      .status(404)
      .json({ success: false, error: "Relationship not found" });
  await AssetRelationship.deleteOne({ _id: item._id });
  if (item.type === "CONTAINS")
    await Asset.updateOne({ _id: item.to }, { $unset: { parent: 1 } });
  await audit(
    req.user.id,
    "DELETE",
    "AssetRelationship",
    item._id,
    item.toObject(),
    null,
  );
  ok(res, item);
}
export async function graph(req, res) {
  const types = req.query.types?.split(",").filter(Boolean);
  ok(
    res,
    await graphService.graph(
      req.params.assetId,
      req.query.direction,
      Math.min(8, Number(req.query.depth || 3)),
      types,
    ),
  );
}
export async function networkGraph(req, res) {
  const types = req.query.types?.split(",").filter(Boolean);
  ok(res, await graphService.network(types, req.query.limit));
}
export async function impact(req, res) {
  ok(res, await graphService.impact(req.params.assetId));
}
export async function simulate(req, res) {
  const body = z
    .object({ failureLevel: z.number().min(0).max(1) })
    .parse(req.body);
  ok(res, await graphService.impact(req.params.assetId, body.failureLevel));
}
export async function criticalNodes(req, res) {
  const rows = await graphService.criticalNodes();
  ok(
    res,
    rows.map(({ asset, score }) => ({
      assetId: asset.assetId,
      name: asset.name,
      typeKey: asset.typeKey,
      criticality: asset.criticality,
      downstreamDependents: Math.round(score / (asset.criticality || 1)),
      singlePointScore: score,
    })),
  );
}
