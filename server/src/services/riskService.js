import {
  Asset,
  AssetType,
  MaintenanceRecord,
  RiskAssessment,
  RiskConfig,
} from "../models.js";
import { RISK_WEIGHTS } from "../config/risk.js";
import { cascadeRisk } from "./graphService.js";
import { statusFor } from "./conditionService.js";

const ageFactor = (asset) =>
  Math.min(
    100,
    Math.max(
      0,
      ((Date.now() - new Date(asset.constructedOn).getTime()) /
        31557600000 /
        (asset.expectedUsefulLifeYears || 25)) *
        100,
    ),
  );
const overdueFactor = (asset) =>
  asset.nextInspectionDue && new Date(asset.nextInspectionDue) < new Date()
    ? 100
    : 0;
const levelFor = (score) =>
  score >= 80
    ? "CRITICAL"
    : score >= 60
      ? "HIGH"
      : score >= 35
        ? "MEDIUM"
        : "LOW";

export async function calculate(asset) {
  const config = await RiskConfig.findOne({ key: "global" }).lean();
  const weights = config?.weights || RISK_WEIGHTS;
  const dependencyImpact = await cascadeRisk(asset.assetId);
  const factors = {
    condition: 100 - (asset.condition?.score || 0),
    criticality: asset.criticality || 0,
    traffic: asset.trafficImportance || 0,
    age: ageFactor(asset),
    failureHistory: Math.min((asset.failureHistoryCount || 0) * 25, 100),
    inspectionStatus: overdueFactor(asset),
    dependencyImpact,
  };
  const score = Math.round(
    Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + factors[key] * weight,
      0,
    ),
  );
  const level = levelFor(score);
  const reasons = [];
  if (factors.condition >= 30)
    reasons.push(
      `deteriorating condition (${asset.condition?.score || 0}/100)`,
    );
  if (factors.criticality >= 70)
    reasons.push(`high criticality (${asset.criticality})`);
  if (factors.traffic >= 70)
    reasons.push(`high traffic importance (${asset.trafficImportance})`);
  if (factors.age >= 60) reasons.push("asset age relative to useful life");
  if (factors.failureHistory > 0)
    reasons.push(`${asset.failureHistoryCount} failure history events`);
  if (factors.inspectionStatus > 0) reasons.push("overdue inspection");
  if (factors.dependencyImpact > 0)
    reasons.push(
      `affects ${Math.round(factors.dependencyImpact)} downstream impact points`,
    );
  const type = await AssetType.findOne({ key: asset.typeKey }).lean();
  const children = type?.componentTemplates?.length
    ? await Asset.find({ parent: asset._id }).lean()
    : [];
  const weakest = children.sort(
    (a, b) => (a.condition?.score || 0) - (b.condition?.score || 0),
  )[0];
  if (weakest)
    reasons.push(
      `${weakest.name.replace(` ${asset.assetId}`, "")} ${weakest.condition?.score}/100`,
    );
  const summary = `${asset.assetId} is ${level} priority because of ${reasons.join(", ")}.`;
  const costs = await MaintenanceRecord.find({ asset: asset._id })
    .sort({ year: -1 })
    .limit(2)
    .lean();
  const trend = costs.length === 2 && costs[0].cost > costs[1].cost;
  const recommendedAction =
    asset.condition?.score < 40
      ? "REPLACE_REVIEW"
      : asset.condition?.score < 60 || trend
        ? "REHABILITATE"
        : level === "HIGH" || level === "CRITICAL"
          ? "REPAIR"
          : "MONITOR";
  return {
    factors,
    score,
    level,
    reasons: [summary, ...reasons],
    summary,
    recommendedAction,
  };
}

export async function recompute(asset) {
  const result = await calculate(asset);
  await RiskAssessment.findOneAndUpdate(
    { asset: asset._id },
    { asset: asset._id, ...result, computedAt: new Date() },
    { upsert: true, new: true },
  );
  await Asset.updateOne(
    { _id: asset._id },
    {
      $set: {
        status: statusFor(
          asset.condition?.score || 0,
          result.level,
          asset.lifecycleStage,
        ),
      },
    },
  );
  return result;
}

export async function recomputeAll() {
  for (const asset of await Asset.find()) await recompute(asset);
  return RiskAssessment.countDocuments();
}
