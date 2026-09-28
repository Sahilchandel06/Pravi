import { AssetType, AuditLog, Counter, WorkOrder } from "./models.js";
export const audit = async (user, action, entity, entityId, before, after) =>
  AuditLog.create({ user, action, entity, entityId, before, after });
export const nextWorkOrder = async () => {
  const c = await Counter.findOneAndUpdate(
    { _id: "workOrder" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return c.seq;
};
export const createWorkOrder = async (data, actor) => {
  const item = await WorkOrder.create({
    ...data,
    woNumber: await nextWorkOrder(),
  });
  await audit(actor, "CREATE", "WorkOrder", item._id, null, item.toObject());
  return item;
};
export const conditionRating = (score) =>
  score < 50 ? "CRITICAL" : score < 75 ? "ATTENTION" : "HEALTHY";
export const riskFor = async (asset) => {
  const type = await AssetType.findOne({ key: asset.typeKey }).lean();
  const score = Math.round(
    (100 - (asset.condition?.score || 0)) * 0.45 +
      (asset.criticality || 0) * 0.3 +
      (asset.trafficImportance || 0) * 0.2 +
      (asset.failureHistoryCount || 0) * 1.25,
  );
  const reasons = [
    `Condition score is ${asset.condition?.score || 0}/100`,
    `Criticality is ${asset.criticality || 0}/100`,
  ];
  if ((asset.failureHistoryCount || 0) > 0)
    reasons.push(`${asset.failureHistoryCount} recorded failure events`);
  return {
    factors: {
      condition: asset.condition?.score || 0,
      criticality: asset.criticality || 0,
      trafficImportance: asset.trafficImportance || 0,
      failureHistoryCount: asset.failureHistoryCount || 0,
      assetType: type?.key,
    },
    score: Math.min(100, score),
    level: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
    reasons,
    recommendedAction:
      score >= 70 ? "Schedule intervention" : "Continue planned inspection",
  };
};
