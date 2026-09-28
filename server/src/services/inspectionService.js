import {
  Asset,
  AssetType,
  AuditLog,
  Inspection,
  MaintenanceRequest,
} from "../models.js";
import * as conditionService from "./conditionService.js";
import * as lifecycleService from "./lifecycleService.js";
import * as riskService from "./riskService.js";

const ratingScores = { GOOD: 85, MODERATE: 65, POOR: 40, CRITICAL: 20 };
const scoreFor = (rating) =>
  typeof rating === "number"
    ? rating
    : ratingScores[String(rating).toUpperCase()];

export async function record(input, inspectorId) {
  const asset = await Asset.findOne({ assetId: input.assetId });
  if (!asset)
    throw Object.assign(new Error("Asset not found"), { status: 404 });
  const type = await AssetType.findOne({ key: asset.typeKey }).lean();
  const before = asset.condition?.score || 0;
  const results = input.results.map((result) => ({
    ...result,
    component: result.componentId,
    rating: result.rating,
  }));
  const item = await Inspection.create({
    asset: asset._id,
    inspector: inspectorId,
    date: new Date(),
    results,
    observations: input.observations,
    photos: input.photos || [],
    conditionBefore: before,
  });
  for (const result of input.results) {
    const child = await Asset.findOne({
      assetId: result.componentId,
      parent: asset._id,
    });
    const score = scoreFor(result.rating);
    if (child && score !== undefined) {
      child.condition = {
        ...(child.condition?.toObject?.() || child.condition),
        score,
        rating: conditionService.ratingFor(score),
        lastAssessedAt: new Date(),
      };
      await child.save();
    }
  }
  await conditionService.recomputeAsset(await Asset.findById(asset._id).lean());
  await conditionService.recomputeAncestors(
    await Asset.findById(asset._id).lean(),
  );
  const current = await Asset.findById(asset._id).lean();
  const risk = await riskService.recompute(current);
  let ancestor = current.parent;
  while (ancestor) {
    const parent = await Asset.findById(ancestor).lean();
    if (!parent) break;
    await riskService.recompute(parent);
    ancestor = parent.parent;
  }
  const poor = input.results.filter((result) => {
    const score = scoreFor(result.rating);
    return score !== undefined && score < 60;
  });
  let request = null;
  if (poor.length)
    request = await MaintenanceRequest.create({
      asset: asset._id,
      component: poor.map((item) => item.componentId).join(","),
      issue: poor
        .map((item) => `${item.componentId}: ${item.rating}`)
        .join("; "),
      priority: risk.level,
      recommendedAction: risk.recommendedAction,
      requestedBy: inspectorId,
    });
  if (request)
    await AuditLog.create({
      user: inspectorId,
      action: "CREATE",
      entity: "MaintenanceRequest",
      entityId: request._id,
      before: null,
      after: request.toObject(),
    });
  const interval = type?.inspectionIntervalMonths || 12;
  await Asset.updateOne(
    { _id: asset._id },
    {
      $set: {
        lastInspectionAt: item.date,
        nextInspectionDue: new Date(
          item.date.getTime() + interval * 2592000000,
        ),
        "condition.lastAssessedAt": item.date,
      },
    },
  );
  item.conditionAfter = current.condition?.score;
  await item.save();
  await lifecycleService.record(
    input.assetId,
    "INSPECTION",
    "Condition inspection",
    input.observations || "Inspection recorded",
  );
  return {
    item,
    conditionBefore: before,
    conditionAfter: current.condition?.score,
    risk,
    recommendedAction: risk.recommendedAction,
    createdRequestId: request?._id || null,
  };
}
