import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Asset,
  AssetType,
  MaintenanceRecord,
  RiskAssessment,
  WorkOrder,
} from "../models.js";
import { graphService, riskService } from "./index.js";

const source = (assetId, label) => ({ assetId, label });
async function listAssets(args = {}) {
  const filter = {};
  if (args.typeKey) filter.typeKey = args.typeKey;
  if (args.status) filter.status = args.status;
  const assets = await Asset.find(filter).lean();
  const rows = await Promise.all(
    assets.map(async (asset) => ({
      assetId: asset.assetId,
      name: asset.name,
      typeKey: asset.typeKey,
      status: asset.status,
      condition: asset.condition?.score,
      risk:
        (
          await RiskAssessment.findOne({ asset: asset._id })
            .sort({ computedAt: -1 })
            .lean()
        )?.level || null,
    })),
  );
  return args.riskLevel
    ? rows.filter((row) => row.risk === args.riskLevel)
    : rows;
}
async function getAssetDetails({ assetId }) {
  const asset = await Asset.findOne({ assetId }).lean();
  if (!asset) return null;
  return {
    assetId,
    name: asset.name,
    typeKey: asset.typeKey,
    status: asset.status,
    condition: asset.condition,
    criticality: asset.criticality,
    trafficImportance: asset.trafficImportance,
  };
}
async function getRiskExplanation({ assetId }) {
  const asset = await Asset.findOne({ assetId }).lean();
  return asset ? { assetId, ...(await riskService.calculate(asset)) } : null;
}
async function getPriorityRanking({ limit = 5 }) {
  const assets = await Asset.find().lean();
  const rows = await Promise.all(
    assets.map(async (asset) => ({
      assetId: asset.assetId,
      name: asset.name,
      ...(await riskService.calculate(asset)),
    })),
  );
  return rows.sort((a, b) => b.score - a.score).slice(0, Math.min(20, limit));
}
async function getComponentConditions({ assetId }) {
  const asset = await Asset.findOne({ assetId });
  return asset
    ? {
        assetId,
        components: await Asset.find({ parent: asset._id })
          .select("assetId name typeKey condition")
          .lean(),
      }
    : null;
}
async function getImpactAnalysis({ assetId }) {
  return graphService.impact(assetId);
}
async function getCriticalNodes() {
  return (await graphService.criticalNodes()).map(({ asset, score }) => ({
    assetId: asset.assetId,
    name: asset.name,
    typeKey: asset.typeKey,
    score,
  }));
}
async function getMaintenanceHistory({ assetId }) {
  const asset = await Asset.findOne({ assetId });
  return asset
    ? MaintenanceRecord.find({ asset: asset._id }).sort({ year: 1 }).lean()
    : null;
}
async function getOpenWorkOrders() {
  return WorkOrder.find({ status: { $in: ["OPEN", "IN_PROGRESS"] } })
    .populate("asset", "assetId name")
    .lean();
}

const tools = {
  listAssets,
  getAssetDetails,
  getRiskExplanation,
  getPriorityRanking,
  getComponentConditions,
  getImpactAnalysis,
  getCriticalNodes,
  getMaintenanceHistory,
  getOpenWorkOrders,
};
const declarations = Object.keys(tools).map((name) => ({
  name,
  description: `InfraLife data lookup: ${name}`,
  parameters: {
    type: "OBJECT",
    properties:
      name === "listAssets"
        ? {
            typeKey: { type: "STRING" },
            status: { type: "STRING" },
            riskLevel: { type: "STRING" },
          }
        : name === "getPriorityRanking"
          ? { limit: { type: "NUMBER" } }
          : { assetId: { type: "STRING" } },
  },
}));
const system =
  "You are the InfraLife assistant for government infrastructure managers. Answer only using tool results. If data is unavailable, say so. Be concise, cite asset IDs and scores.";

async function fallback(message) {
  const text = message.toLowerCase();
  if (
    text.includes("which") &&
    (text.includes("bridge") || text.includes("attention"))
  ) {
    const rows = (await listAssets({ typeKey: "bridge" })).filter(
      (row) =>
        row.status !== "HEALTHY" || ["HIGH", "CRITICAL"].includes(row.risk),
    );
    return {
      answer: rows.length
        ? rows
            .map(
              (row) =>
                `${row.assetId} (${row.condition}/100, ${row.risk || "LOW"})`,
            )
            .join(", ")
        : "No bridge assets require attention.",
      sources: rows.map((row) => source(row.assetId, "listAssets")),
    };
  }
  if (text.includes("why") && text.includes("br-102")) {
    const result = await getRiskExplanation({ assetId: "BR-102" });
    return {
      answer: `${result.summary} Score ${result.score}/100.`,
      sources: [source("BR-102", "getRiskExplanation")],
    };
  }
  if (text.includes("happens") && text.includes("br-102")) {
    const result = await getImpactAnalysis({ assetId: "BR-102" });
    return {
      answer: `${result.summary.totalAffected} assets are affected: ${result.affected.map((item) => `${item.asset.assetId} (${item.impactScore})`).join(", ")}.`,
      sources: [source("BR-102", "getImpactAnalysis")],
    };
  }
  if (text.includes("single point") || text.includes("failure")) {
    const result = await getCriticalNodes();
    return {
      answer:
        result
          .slice(0, 5)
          .map((item) => `${item.assetId} (${item.score})`)
          .join(", ") || "No critical nodes are available.",
      sources: result
        .slice(0, 5)
        .map((item) => source(item.assetId, "getCriticalNodes")),
    };
  }
  return {
    answer:
      "The assistant is unavailable because GEMINI_API_KEY is not configured.",
    sources: [],
  };
}

export async function chat(message) {
  if (!process.env.GEMINI_API_KEY) return fallback(message);
  try {
    const model = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY,
    ).getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      systemInstruction: system,
      tools: [{ functionDeclarations: declarations }],
    });
    const session = model.startChat({ history: [] });
    let response = await session.sendMessage(message);
    const sources = [];
    for (let round = 0; round < 6; round += 1) {
      const calls = response.response.functionCalls?.() || [];
      if (!calls.length) return { answer: response.response.text(), sources };
      const functionResponses = [];
      for (const call of calls) {
        const data = await tools[call.name](call.args || {});
        if (call.args?.assetId)
          sources.push(source(call.args.assetId, call.name));
        functionResponses.push({
          functionResponse: { name: call.name, response: { result: data } },
        });
      }
      response = await session.sendMessage(functionResponses);
    }
    return {
      answer: "The assistant could not complete the requested lookup.",
      sources,
    };
  } catch (error) {
    console.error(error.message);
    return { answer: "The assistant is temporarily unavailable.", sources: [] };
  }
}
