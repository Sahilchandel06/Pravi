import mongoose from "mongoose";
const { Schema, model } = mongoose;
const geo = new Schema(
  {
    type: {
      type: String,
      enum: ["Point", "LineString", "Polygon"],
      required: true,
    },
    coordinates: { type: [Schema.Types.Mixed], required: true },
  },
  { _id: false },
);
const user = new Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "INSPECTOR", "MAINTENANCE"],
      required: true,
    },
  },
  { timestamps: true },
);
const assetType = new Schema({
  key: { type: String, unique: true },
  label: String,
  sector: String,
  isComponent: Boolean,
  attributeSchema: [
    {
      _id: false,
      key: String,
      label: String,
      type: { type: String },
      unit: String,
      options: [String],
    },
  ],
  componentTemplates: [
    { childTypeKey: String, name: String, conditionWeight: Number },
  ],
  defaultUsefulLifeYears: Number,
  inspectionIntervalMonths: Number,
  allowedRelationships: [
    { _id: false, type: { type: String }, toTypeKey: String },
  ],
});
const asset = new Schema({
  assetId: { type: String, unique: true },
  name: String,
  typeKey: String,
  sector: String,
  parent: { type: Schema.Types.ObjectId, ref: "Asset" },
  location: { type: geo, index: "2dsphere" },
  attributes: Schema.Types.Mixed,
  constructedOn: Date,
  expectedUsefulLifeYears: Number,
  condition: {
    score: Number,
    rating: String,
    lastAssessedAt: Date,
    breakdown: [
      { _id: false, component: String, score: Number, weight: Number },
    ],
  },
  criticality: Number,
  trafficImportance: Number,
  failureHistoryCount: Number,
  lifecycleStage: {
    type: String,
    enum: ["OPERATIONAL", "UNDER_MAINTENANCE", "REHABILITATION"],
  },
  status: {
    type: String,
    enum: ["HEALTHY", "ATTENTION", "CRITICAL", "UNDER_MAINTENANCE"],
  },
  lastInspectionAt: Date,
  nextInspectionDue: Date,
});
const relationship = new Schema({
  from: { type: Schema.Types.ObjectId, ref: "Asset" },
  to: { type: Schema.Types.ObjectId, ref: "Asset" },
  type: {
    type: String,
    enum: ["CONTAINS", "DEPENDS_ON", "CONNECTS_TO", "DRAINS_TO"],
  },
  weight: Number,
});
relationship.index({ from: 1, to: 1, type: 1 }, { unique: true });
relationship.index({ from: 1 });
relationship.index({ to: 1 });
const inspection = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  inspector: { type: Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, required: true },
  results: [
    {
      componentId: String,
      component: String,
      rating: Schema.Types.Mixed,
      notes: String,
    },
  ],
  observations: String,
  photos: [String],
  conditionBefore: Number,
  conditionAfter: Number,
});
const risk = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  factors: Schema.Types.Mixed,
  score: Number,
  level: String,
  reasons: [String],
  recommendedAction: String,
  computedAt: { type: Date, default: Date.now },
});
const maintenanceRequest = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  component: String,
  issue: String,
  recommendedAction: String,
  estimatedCost: Number,
  dueDate: Date,
  requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
  priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
});
const workOrder = new Schema({
  woNumber: { type: Number, unique: true },
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  request: { type: Schema.Types.ObjectId, ref: "MaintenanceRequest" },
  issue: String,
  priority: String,
  assignedTeam: String,
  estimatedCost: Number,
  dueDate: Date,
  status: {
    type: String,
    enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED"],
    default: "OPEN",
  },
  completionEvidence: [String],
  createdAt: { type: Date, default: Date.now },
});
const maintenanceRecord = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  cost: Number,
  year: Number,
});
const lifecycleEvent = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset" },
  type: String,
  title: String,
  description: String,
  date: Date,
});
const documentSchema = new Schema({
  asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  publicId: String,
  resourceType: String,
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});
const audit = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  action: String,
  entity: String,
  entityId: Schema.Types.ObjectId,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  at: { type: Date, default: Date.now },
});
const counter = new Schema({
  _id: String,
  seq: { type: Number, default: 1041 },
});
const riskConfig = new Schema({
  key: { type: String, unique: true, default: "global" },
  weights: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now },
});
export const User = model("User", user),
  AssetType = model("AssetType", assetType),
  Asset = model("Asset", asset),
  AssetRelationship = model("AssetRelationship", relationship),
  Inspection = model("Inspection", inspection),
  RiskAssessment = model("RiskAssessment", risk),
  MaintenanceRequest = model("MaintenanceRequest", maintenanceRequest),
  WorkOrder = model("WorkOrder", workOrder),
  MaintenanceRecord = model("MaintenanceRecord", maintenanceRecord),
  LifecycleEvent = model("LifecycleEvent", lifecycleEvent),
  Document = model("Document", documentSchema),
  AuditLog = model("AuditLog", audit),
  Counter = model("Counter", counter),
  RiskConfig = model("RiskConfig", riskConfig);
