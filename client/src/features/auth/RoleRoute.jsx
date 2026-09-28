import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RoleRoute({ roles }) {
  const { user } = useAuth();
  const location = useLocation();
  return roles.includes(user?.role) ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace state={{ from: location }} />
  );
}
