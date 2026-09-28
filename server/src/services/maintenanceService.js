import {
  Asset,
  AssetType,
  AuditLog,
  Counter,
  LifecycleEvent,
  MaintenanceRecord,
  MaintenanceRequest,
  RiskAssessment,
  WorkOrder,
} from "../models.js";
import * as conditionService from "./conditionService.js";
import * as riskService from "./riskService.js";

export const transitions = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: "CLOSED",
};

export async function approveRequest(request, input, userId) {
  if (request.status !== "PENDING")
    throw Object.assign(new Error("Request is already decided"), {
      status: 409,
    });
  const asset = await Asset.findById(request.asset);
  const risk = await RiskAssessment.findOne({ asset: request.asset })
    .sort({ computedAt: -1 })
    .lean();
  const item = await WorkOrder.create({
    request: request._id,
    asset: request.asset,
    issue: request.issue,
    priority: input.priority || risk?.level || "MEDIUM",
    assignedTeam: input.assignedTeam || "Roads maintenance",
    estimatedCost: input.estimatedCost ?? request.estimatedCost ?? 0,
    dueDate:
      input.dueDate || request.dueDate || new Date(Date.now() + 14 * 86400000),
    woNumber: await nextNumber(),
  });
  request.status = "APPROVED";
  await request.save();
  await AuditLog.create({
    user: userId,
    action: "APPROVE",
    entity: "MaintenanceRequest",
    entityId: request._id,
    before: { status: "PENDING" },
    after: { status: "APPROVED", workOrder: item._id },
  });
  return item;
}

export async function rejectRequest(request, userId) {
  if (request.status !== "PENDING")
    throw Object.assign(new Error("Request is already decided"), {
      status: 409,
    });
  request.status = "REJECTED";
  await request.save();
  return AuditLog.create({
    user: userId,
    action: "REJECT",
    entity: "MaintenanceRequest",
    entityId: request._id,
    before: { status: "PENDING" },
    after: { status: "REJECTED" },
  });
}

export async function nextNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "workOrder" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return counter.seq;
}

export async function changeStatus(workOrder, nextStatus, evidence, userId) {
  const expected = transitions[workOrder.status];
  if (expected !== nextStatus)
    throw Object.assign(
      new Error(`Invalid transition from ${workOrder.status} to ${nextStatus}`),
      { status: 409 },
    );
  if (nextStatus === "COMPLETED" && (!evidence || evidence.length === 0))
    throw Object.assign(new Error("completionEvidence is required"), {
      status: 400,
    });
  const before = workOrder.toObject();
  workOrder.status = nextStatus;
  if (evidence) workOrder.completionEvidence = evidence;
  await workOrder.save();
  const asset = await Asset.findById(workOrder.asset);
  if (!asset) return workOrder;
  if (nextStatus === "IN_PROGRESS") {
    asset.lifecycleStage = "UNDER_MAINTENANCE";
    await asset.save();
  }
  if (nextStatus === "COMPLETED") await finishRepair(workOrder, asset, userId);
  if (nextStatus === "CLOSED") {
    asset.lifecycleStage = "OPERATIONAL";
    await asset.save();
    await conditionService.recomputeAsset(asset);
    await riskService.recompute(await Asset.findById(asset._id).lean());
  }
  await AuditLog.create({
    user: userId,
    action: "STATUS_CHANGE",
    entity: "WorkOrder",
    entityId: workOrder._id,
    before,
    after: workOrder.toObject(),
  });
  return workOrder;
}

async function finishRepair(workOrder, asset, userId) {
  await MaintenanceRecord.create({
    asset: asset._id,
    cost: workOrder.estimatedCost || 0,
    year: new Date().getFullYear(),
  });
  const event = await LifecycleEvent.create({
    asset: asset._id,
    type: "REPAIR",
    title: `Work order ${workOrder.woNumber} completed`,
    description: workOrder.issue,
    date: new Date(),
  });
  await AuditLog.create({
    user: userId,
    action: "CREATE",
    entity: "MaintenanceRecord",
    entityId: asset._id,
    before: null,
    after: { asset: asset.assetId, cost: workOrder.estimatedCost || 0 },
  });
  await AuditLog.create({
    user: userId,
    action: "CREATE",
    entity: "LifecycleEvent",
    entityId: event._id,
    before: null,
    after: event.toObject(),
  });
  asset.lifecycleStage = "UNDER_MAINTENANCE";
  await asset.save();
  await conditionService.recomputeAsset(await Asset.findById(asset._id).lean());
  await riskService.recompute(await Asset.findById(asset._id).lean());
}

export async function maintenanceCost(assetId) {
  const asset = await Asset.findOne({ assetId });
  if (!asset)
    throw Object.assign(new Error("Asset not found"), { status: 404 });
  const rows = await MaintenanceRecord.aggregate([
    { $match: { asset: asset._id } },
    { $group: { _id: "$year", total: { $sum: "$cost" } } },
    { $sort: { _id: 1 } },
  ]);
  const increased =
    rows.length >= 3 &&
    rows.at(-1).total > rows.at(-2).total &&
    rows.at(-2).total > rows.at(-3).total;
  return {
    yearlySpend: rows.map((row) => ({ year: row._id, amount: row.total })),
    trendWarning: increased
      ? "Maintenance expenditure has increased significantly over the recent lifecycle, triggering a rehabilitation/replacement review."
      : null,
  };
}

export async function lifecycle(assetId) {
  const asset = await Asset.findOne({ assetId });
  if (!asset)
    throw Object.assign(new Error("Asset not found"), { status: 404 });
  const events = await LifecycleEvent.find({ asset: asset._id })
    .sort({ date: 1 })
    .lean();
  events.push({
    asset: asset._id,
    type: "PROJECTED",
    title: "Future: Rehabilitation/Replacement",
    description:
      "Projected from current condition, risk, useful life, and maintenance trend.",
    date: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
    projected: true,
  });
  return events;
}
