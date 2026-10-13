import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { canManageEmployees } from "../access";

export function EmployeeAdminRoute() {
  const role = useAuthStore((state) => state.user?.role);
  const location = useLocation();

  if (!canManageEmployees(role)) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location,
          authNotice: {
            message: "You do not have permission to manage employees.",
            variant: "error",
          },
        }}
      />
    );
  }

  return <Outlet />;
}
