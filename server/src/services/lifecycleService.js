import { Asset, LifecycleEvent } from "../models.js";

export async function record(assetId, type, title, description = "") {
  const asset = await Asset.findOne({ assetId });
  if (!asset)
    throw Object.assign(new Error("Asset not found"), { status: 404 });
  return LifecycleEvent.create({
    asset: asset._id,
    type,
    title,
    description,
    date: new Date(),
  });
}
