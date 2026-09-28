import mongoose from "mongoose";
import { Asset, AssetRelationship } from "../models.js";

const downstreamTypes = ["DEPENDS_ON", "CONTAINS", "DRAINS_TO", "CONNECTS_TO"];

async function relationshipWalk(asset, direction, depth, types) {
  const connect = direction === "upstream" ? "to" : "from";
  const match = types?.length ? { type: { $in: types } } : {};
  const rows = await AssetRelationship.aggregate([
    { $match: { ...match, [connect]: asset._id } },
    {
      $graphLookup: {
        from: "assetrelationships",
        startWith: direction === "upstream" ? "$from" : "$to",
        connectFromField: direction === "upstream" ? "to" : "from",
        connectToField: direction === "upstream" ? "to" : "from",
        as: "walk",
        maxDepth: Math.max(0, depth - 1),
        depthField: "hop",
      },
    },
  ]);
  const first = rows[0];
  if (!first) return [];
  return [first, ...(first.walk || [])].map((row) => ({
    ...row,
    hop: row.hop || 0,
  }));
}

export async function graph(assetId, direction = "both", depth = 3, types) {
  const asset = await Asset.findOne({ assetId }).lean();
  if (!asset)
    throw Object.assign(new Error("Asset not found"), { status: 404 });
  const directions =
    direction === "both" ? ["upstream", "downstream"] : [direction];
  const rows = (
    await Promise.all(
      directions.map((item) => relationshipWalk(asset, item, depth, types)),
    )
  ).flat();
  const edgeMap = new Map(rows.map((row) => [String(row._id), row]));
  const edges = [...edgeMap.values()];
  const ids = new Set([
    String(asset._id),
    ...edges.flatMap((edge) => [String(edge.from), String(edge.to)]),
  ]);
  const nodes = await Asset.find({ _id: { $in: [...ids] } }).lean();
  const riskRows = await mongoose.connection
    .collection("riskassessments")
    .find({ asset: { $in: nodes.map((item) => item._id) } })
    .sort({ computedAt: -1 })
    .toArray();
  const riskMap = new Map();
  riskRows.forEach((risk) => {
    if (!riskMap.has(String(risk.asset)))
      riskMap.set(String(risk.asset), risk.level);
  });
  return {
    nodes: nodes.map((item) => ({
      id: String(item._id),
      assetId: item.assetId,
      name: item.name,
      typeKey: item.typeKey,
      status: item.status,
      conditionScore: item.condition?.score ?? null,
      riskLevel: riskMap.get(String(item._id)) || null,
    })),
    edges: edges.map((edge) => ({
      id: String(edge._id),
      source: String(edge.from),
      target: String(edge.to),
      type: edge.type,
      weight: edge.weight,
    })),
  };
}

export async function network(types, limit = 300) {
  const match = types?.length ? { type: { $in: types } } : {};
  const relationships = await AssetRelationship.find(match)
    .limit(Math.min(300, Number(limit) || 300))
    .lean();
  const ids = [
    ...new Set(
      relationships.flatMap((edge) => [String(edge.from), String(edge.to)]),
    ),
  ];
  const assets = await Asset.find({ _id: { $in: ids } }).lean();
  const riskRows = await mongoose.connection
    .collection("riskassessments")
    .find({ asset: { $in: assets.map((item) => item._id) } })
    .sort({ computedAt: -1 })
    .toArray();
  const riskMap = new Map();
  riskRows.forEach((risk) => {
    if (!riskMap.has(String(risk.asset)))
      riskMap.set(String(risk.asset), risk.level);
  });
  return {
    nodes: assets.map((item) => ({
      id: String(item._id),
      assetId: item.assetId,
      name: item.name,
      typeKey: item.typeKey,
      status: item.status,
      conditionScore: item.condition?.score ?? null,
      riskLevel: riskMap.get(String(item._id)) || null,
    })),
    edges: relationships.map((edge) => ({
      id: String(edge._id),
      source: String(edge.from),
      target: String(edge.to),
      type: edge.type,
      weight: edge.weight,
    })),
  };
}

export async function wouldCycle(from, to, type) {
  const fromId = new mongoose.Types.ObjectId(from);
  const toId = new mongoose.Types.ObjectId(to);
  const rows = await AssetRelationship.aggregate([
    { $match: { type, from: toId } },
    {
      $graphLookup: {
        from: "assetrelationships",
        startWith: "$to",
        connectFromField: "to",
        connectToField: "from",
        as: "paths",
      },
    },
  ]);
  return rows.some(
    (row) =>
      String(row.to) === String(fromId) ||
      row.paths.some((path) => String(path.to) === String(fromId)),
  );
}

export async function impact(assetId, scale = 1) {
  const root = await Asset.findOne({ assetId }).lean();
  if (!root) throw Object.assign(new Error("Asset not found"), { status: 404 });
  const affected = [];
  const queue = [
    { id: root._id, hops: 0, score: 100 * scale, path: [root.assetId] },
  ];
  const seen = new Set([String(root._id)]);
  while (queue.length) {
    const current = queue.shift();
    const relations = await AssetRelationship.find({
      to: current.id,
      type: { $in: downstreamTypes },
    }).lean();
    for (const relation of relations) {
      const next = await Asset.findById(relation.from).lean();
      if (!next || seen.has(String(next._id))) continue;
      seen.add(String(next._id));
      const score = current.score * (relation.weight ?? 1) * 0.8;
      const item = {
        asset: {
          assetId: next.assetId,
          name: next.name,
          typeKey: next.typeKey,
          status: next.status,
          conditionScore: next.condition?.score ?? null,
        },
        hops: current.hops + 1,
        impactScore: Math.round(score * 100) / 100,
        path: [...current.path, next.assetId],
        reason: `${relation.type} dependency`,
      };
      affected.push(item);
      queue.push({ id: next._id, hops: item.hops, score, path: item.path });
    }
  }
  const byType = affected.reduce((result, item) => {
    result[item.asset.typeKey] = (result[item.asset.typeKey] || 0) + 1;
    return result;
  }, {});
  return {
    affected,
    summary: {
      totalAffected: affected.length,
      byType,
      highestImpactAsset:
        affected.sort((a, b) => b.impactScore - a.impactScore)[0]?.asset ||
        null,
    },
  };
}

export async function cascadeRisk(assetId) {
  const result = await impact(assetId);
  return Math.min(
    100,
    result.affected.reduce((sum, item) => sum + item.impactScore, 0),
  );
}

export async function criticalNodes() {
  const assets = await Asset.find({}).lean();
  const scores = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      dependents: (await impact(asset.assetId)).affected,
    })),
  );
  return scores
    .map(({ asset, dependents }) => ({
      asset,
      score: dependents.length * (asset.criticality || 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
