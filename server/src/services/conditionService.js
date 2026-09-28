import { Asset, AssetRelationship, AssetType } from "../models.js";
import { CONDITION_SCORES } from "../config/risk.js";

export function ratingFor(score) {
  if (score >= 80) return "GOOD";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "POOR";
  return "CRITICAL";
}

export function statusFor(score, riskLevel, lifecycleStage) {
  if (lifecycleStage === "UNDER_MAINTENANCE") return "UNDER_MAINTENANCE";
  if (score < 50 || riskLevel === "CRITICAL") return "CRITICAL";
  if (score < 70 || ["HIGH", "MEDIUM"].includes(riskLevel)) return "ATTENTION";
  return "HEALTHY";
}

async function childBreakdown(asset) {
  const type = await AssetType.findOne({ key: asset.typeKey }).lean();
  if (!type?.componentTemplates?.length) return [];
  const children = await Asset.find({ parent: asset._id }).lean();
  const available = type.componentTemplates.filter((template) =>
    children.some((child) => child.typeKey === template.childTypeKey),
  );
  const totalWeight = available.reduce(
    (sum, item) => sum + item.conditionWeight,
    0,
  );
  return available.map((template) => {
    const child = children.find(
      (item) => item.typeKey === template.childTypeKey,
    );
    return {
      component: template.name,
      score: child.condition?.score ?? CONDITION_SCORES[ratingFor(0)],
      weight: template.conditionWeight / totalWeight,
    };
  });
}

export async function calculate(asset) {
  const breakdown = await childBreakdown(asset);
  const score = breakdown.length
    ? Math.round(
        breakdown.reduce((sum, item) => sum + item.score * item.weight, 0),
      )
    : (asset.condition?.score ?? CONDITION_SCORES.GOOD);
  return { score, rating: ratingFor(score), breakdown };
}

export async function recomputeAsset(asset, riskLevel) {
  const condition = await calculate(asset);
  const status = statusFor(condition.score, riskLevel, asset.lifecycleStage);
  await Asset.updateOne(
    { _id: asset._id },
    {
      $set: { condition: { ...condition, lastAssessedAt: new Date() }, status },
    },
  );
  return { ...asset, condition, status };
}

export async function recomputeAncestors(asset) {
  let current = asset;
  while (current?.parent) {
    const parent = await Asset.findById(current.parent).lean();
    if (!parent) break;
    current = await recomputeAsset(parent);
  }
  return current;
}

export async function recomputeAll() {
  const assets = await Asset.find().lean();
  const byParent = new Map();
  assets.forEach((asset) => byParent.set(String(asset._id), asset));
  const ordered = [...assets].sort(
    (a, b) => depth(byParent, b) - depth(byParent, a),
  );
  for (const asset of ordered) await recomputeAsset(asset);
  return Asset.countDocuments();
}

function depth(byParent, asset) {
  let count = 0;
  let current = asset;
  while (current?.parent) {
    count += 1;
    current = byParent.get(String(current.parent));
  }
  return count;
}
