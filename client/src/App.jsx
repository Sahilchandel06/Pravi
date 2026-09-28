import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import Login from "./features/auth/Login";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import Dashboard from "./features/dashboard/Dashboard";
import MapPage from "./features/map/MapPage";
import AssetsPage from "./features/assets/AssetsPage";
import AssetDetail from "./features/assets/AssetDetail";
import InspectionForm from "./features/inspection/InspectionForm";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import AssistantPage from "./features/assistant/AssistantPage";
import DependencyGraph from "./features/graph/DependencyGraph";
import AssetForm from "./features/assets/AssetForm";
import AdminRoute from "./features/auth/AdminRoute";
import AssetTypesPage from "./features/admin/AssetTypesPage";
import RoleRoute from "./features/auth/RoleRoute";
import UiGallery from "./features/dev/UiGallery";

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 15000, retry: 1 } },
});
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dev/ui" element={<UiGallery />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="map" element={<MapPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route element={<RoleRoute roles={["ADMIN", "MANAGER"]} />}>
                  <Route path="assets/new" element={<AssetForm />} />
                  <Route path="assets/:assetId/edit" element={<AssetForm />} />
                </Route>
                <Route path="assets/:assetId" element={<AssetDetail />} />
                <Route element={<RoleRoute roles={["INSPECTOR"]} />}>
                  <Route
                    path="assets/:assetId/inspect"
                    element={<InspectionForm />}
                  />
                  <Route path="inspections" element={<AssetsPage />} />
                </Route>
                <Route path="graph" element={<DependencyGraph />} />
                <Route path="graph/:assetId" element={<GraphRoute />} />
                <Route
                  element={
                    <RoleRoute roles={["ADMIN", "MANAGER", "MAINTENANCE"]} />
                  }
                >
                  <Route path="maintenance" element={<MaintenancePage />} />
                </Route>
                <Route path="assistant" element={<AssistantPage />} />
                <Route element={<AdminRoute />}>
                  <Route
                    path="admin/asset-types"
                    element={<AssetTypesPage />}
                  />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
function GraphRoute() {
  const assetId = window.location.pathname.split("/").pop();
  return <DependencyGraph assetId={assetId} />;
}
