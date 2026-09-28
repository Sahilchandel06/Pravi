import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminRoute() {
  return useAuth().user?.role === "ADMIN" ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}
