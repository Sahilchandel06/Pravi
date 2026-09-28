import { Router } from "express";
import { asyncHandler, authenticate, authorize, ok } from "./middleware.js";
import * as c from "./controllers.js";
import { upload } from "./middleware/upload.js";

export const router = Router();
router.get("/health", (req, res) =>
  ok(res, {
    status: "ok",
    db: req.app.locals.dbStatus || "disconnected",
    time: new Date().toISOString(),
  }),
);
router.post("/auth/login", asyncHandler(c.login));
router.get("/auth/me", authenticate, asyncHandler(c.me));
router.use(authenticate);
router.get("/audit", authorize("MANAGER", "ADMIN"), asyncHandler(c.listAudit));
router.post("/uploads", upload.single("file"), asyncHandler(c.uploadFile));
router.post(
  "/documents",
  upload.single("file"),
  asyncHandler(c.createDocument),
);
router.get("/documents", asyncHandler(c.listDocuments));
router.delete("/documents/:id", asyncHandler(c.deleteDocument));
router.get("/asset-types", asyncHandler(c.listTypes));
router.post(
  "/asset-types",
  authorize("ADMIN"),
  asyncHandler(c.createAssetType),
);
router.put(
  "/asset-types/:key",
  authorize("ADMIN"),
  asyncHandler(c.updateAssetType),
);
router.post("/admin/reset-demo", authorize("ADMIN"), asyncHandler(c.resetDemo));
router.get("/risk-config", authorize("ADMIN"), asyncHandler(c.getRiskConfig));
router.put(
  "/risk-config",
  authorize("ADMIN"),
  asyncHandler(c.updateRiskConfig),
);
router.post(
  "/risk/recompute-all",
  authorize("ADMIN"),
  asyncHandler(c.recomputeRisks),
);
router.post("/assistant/chat", asyncHandler(c.assistant));
router.post(
  "/inspections",
  authorize("INSPECTOR"),
  asyncHandler(c.submitInspection),
);
router.get("/inspections", asyncHandler(c.listInspections));
router.get("/maintenance/requests", asyncHandler(c.listMaintenanceRequests));
router.post(
  "/maintenance/requests/:id/approve",
  authorize("MANAGER", "ADMIN"),
  asyncHandler(c.approveMaintenanceRequest),
);
router.post(
  "/maintenance/requests/:id/reject",
  authorize("MANAGER", "ADMIN"),
  asyncHandler(c.rejectMaintenanceRequest),
);
router.get("/work-orders", asyncHandler(c.listWorkOrders));
router.patch(
  "/work-orders/:id/status",
  authorize("MAINTENANCE", "MANAGER", "ADMIN"),
  asyncHandler(c.updateWorkOrderStatus),
);
router.get("/assets/geojson", asyncHandler(c.geojson));
router.get("/assets/:assetId/qr", asyncHandler(c.assetQr));
router.get(
  "/assets/:assetId/maintenance-cost",
  asyncHandler(c.maintenanceCost),
);
router.get("/assets/:assetId/lifecycle", asyncHandler(c.lifecycle));
router.get("/assets", asyncHandler(c.listAssets));
router.post(
  "/assets",
  authorize("ADMIN", "MANAGER"),
  asyncHandler(c.createAsset),
);
router.put(
  "/assets/:assetId",
  authorize("ADMIN", "MANAGER"),
  asyncHandler(c.updateAsset),
);
router.delete(
  "/assets/:assetId",
  authorize("ADMIN", "MANAGER"),
  asyncHandler(c.deleteAsset),
);
router.get("/dashboard/summary", asyncHandler(c.dashboardSummary));
router.get("/dashboard", asyncHandler(c.dashboardSummary));
router.get("/graph/critical-nodes", asyncHandler(c.criticalNodes));
router.get("/graph", asyncHandler(c.networkGraph));
router.get("/graph/:assetId/impact", asyncHandler(c.impact));
router.post("/graph/:assetId/simulate", asyncHandler(c.simulate));
router.get("/graph/:assetId", asyncHandler(c.graph));
router.get("/risk/ranking", asyncHandler(c.rankRisk));
router.get("/risk/:assetId", asyncHandler(c.getRisk));
router.post(
  "/relationships",
  authorize("ADMIN", "MANAGER"),
  asyncHandler(c.createRelationship),
);
router.delete(
  "/relationships/:id",
  authorize("ADMIN", "MANAGER"),
  asyncHandler(c.deleteRelationship),
);
router.post(
  "/assets/:assetId/inspections",
  authorize("ADMIN", "MANAGER", "INSPECTOR"),
  asyncHandler(c.createInspection),
);
router.get("/assets/:assetId", asyncHandler(c.getAsset));
