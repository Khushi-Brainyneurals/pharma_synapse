import type { AuthenticatedUser } from "../auth/api/auth.types";

/** Login-response feature flags (`access.features`) that drive the Dashboard. */
export const DASHBOARD_FEATURES = {
  PERSONAL: "personal_dashboard",
  COMPANY: "company_dashboard",
  ACTIVITY_GRAPH: "activity_graph",
} as const;

export type DashboardScope = "personal" | "company";

/**
 * What the Dashboard may show this user, from the `features` of the login response.
 * The sidebar entry and the route both read this, so they can never disagree.
 */
export function dashboardAccess(user: AuthenticatedUser | null | undefined) {
  const features = user?.features ?? {};
  const canViewPersonal = features[DASHBOARD_FEATURES.PERSONAL] === true;
  const canViewCompany = features[DASHBOARD_FEATURES.COMPANY] === true;
  /** Department performance, document activity and equipment graphs. */
  const canViewGraphs = features[DASHBOARD_FEATURES.ACTIVITY_GRAPH] === true;
  const canViewDocuments = canViewPersonal || canViewCompany;
  return {
    canViewPersonal,
    canViewCompany,
    canViewGraphs,
    /** Status cards and recent activity (personal or company). */
    canViewDocuments,
    canView: canViewDocuments || canViewGraphs,
    /** The Personal / Company switch only appears when both views are granted. */
    canSwitch: canViewPersonal && canViewCompany,
    defaultScope: (canViewPersonal ? "personal" : "company") as DashboardScope,
  };
}
