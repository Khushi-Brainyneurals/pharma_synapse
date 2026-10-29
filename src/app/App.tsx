import { lazy, Suspense, type ReactNode, Component } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { env } from "../shared/config/env";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SetPasswordPage } from "../features/auth/pages/SetPasswordPage";
import { useAuthStore } from "../features/auth/state/auth.store";
import { EmployeeAdminRoute } from "../features/employees/routing/EmployeeAdminRoute";
import { LoginStatesPage } from "../features/auth/pages/LoginStatesPage";
import { ProtectedRoute } from "../features/auth/routing/ProtectedRoute";
import { AppHeader } from "./layout/AppHeader";
import { AppSidebar } from "./layout/AppSidebar";
import { ROUTES } from "./routing/routes";

const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CoreInputsPage = lazy(() => import("../features/document-workflows/bmr-bpr/inputs/pages/CoreInputsPage").then((m) => ({ default: m.CoreInputsPage })));
const NewDocumentSelectorPage = lazy(() => import("../features/document-workflows/selection/pages/NewDocumentSelectorPage").then((m) => ({ default: m.NewDocumentSelectorPage })));
const PvpSelectDocumentPage = lazy(() => import("../features/document-workflows/pvp-pvr/select-document/pages/SelectDocumentPage").then((m) => ({ default: m.SelectDocumentPage })));
const PvpCoverDetailsPage = lazy(() => import("../features/document-workflows/pvp-pvr/cover-details/pages/PvpCoverDetailsPage").then((m) => ({ default: m.PvpCoverDetailsPage })));
const PvpProcessBomPage = lazy(() => import("../features/document-workflows/pvp-pvr/process-bom/pages/PvpProcessBomPage").then((m) => ({ default: m.PvpProcessBomPage })));
const CoverBomPage = lazy(() => import("../features/document-workflows/bmr-bpr/bom/pages/CoverBomPage").then((m) => ({ default: m.CoverBomPage })));
const CompanyInfoPage = lazy(() => import("../features/company/pages/CompanyInfoPage").then((m) => ({ default: m.CompanyInfoPage })));
const MasterDataPage = lazy(() => import("../features/master-data/pages/MasterDataPage").then((m) => ({ default: m.MasterDataPage })));
const DocumentReviewPage = lazy(() => import("../features/review/pages/DocumentReviewPage").then((m) => ({ default: m.DocumentReviewPage })));
const DocumentFinalizePage = lazy(() => import("../features/review/pages/DocumentFinalizePage").then((m) => ({ default: m.DocumentFinalizePage })));
const ReviewQueuePage = lazy(() => import("../features/review/pages/ReviewQueuePage").then((m) => ({ default: m.ReviewQueuePage })));
const VersionHistoryPage = lazy(() => import("../features/version-history/pages/VersionHistoryPage").then((m) => ({ default: m.VersionHistoryPage })));
const NotificationsPage = lazy(() => import("../features/notifications/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const AuditTrailPage = lazy(() => import("../features/audit-trail/pages/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));
const MdSetupTypePage = lazy(() => import("../features/master-data-setup/pages/TypePage").then((m) => ({ default: m.TypePage })));
const MdStageDocsPage = lazy(() => import("../features/master-data-setup/pages/StageDocumentsPage").then((m) => ({ default: m.StageDocumentsPage })));
const MdEquipmentPage = lazy(() => import("../features/master-data-setup/pages/EquipmentListPage").then((m) => ({ default: m.EquipmentListPage })));
const MdInstrumentPage = lazy(() => import("../features/master-data-setup/pages/InstrumentListPage").then((m) => ({ default: m.InstrumentListPage })));
const MdBatchDocsPage = lazy(() => import("../features/master-data-setup/pages/BatchDocumentsPage").then((m) => ({ default: m.BatchDocumentsPage })));
const MdPreviewPage = lazy(() => import("../features/master-data-setup/pages/PreviewPage").then((m) => ({ default: m.PreviewPage })));
const GenerateSubmitPage = lazy(() => import("../features/document-workflows/bmr-bpr/generate/pages/GenerateSubmitPage").then((m) => ({ default: m.GenerateSubmitPage })));
const StageInputPage = lazy(() => import("../features/document-workflows/bmr-bpr/stage-input/pages/StageInputPage").then((m) => ({ default: m.StageInputPage })));
const SelectStagesPage = lazy(() => import("../features/document-workflows/bmr-bpr/stages/pages/SelectStagesPage").then((m) => ({ default: m.SelectStagesPage })));
const EmployeesPage = lazy(() => import("../features/employees/pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage })));

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("UI Uncaught Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-text">
          <div className="max-w-md w-full rounded-card border border-danger/30 bg-surface p-6 shadow-modal">
            <h2 className="text-h2 font-semibold text-danger mb-2">Something went wrong</h2>
            <p className="text-small text-subdued mb-4">
              {isChunkLoadError(this.state.error)
                ? "This page could not be downloaded. Check your connection and reload to try again."
                : this.state.error?.message ?? "An unexpected rendering error occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex h-9 items-center justify-center rounded-control bg-primary px-4 text-small font-semibold text-white hover:bg-primary-dark"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.setPassword} element={<SetPasswordPage />} />
        {env.isDev ? <Route path="/login/states" element={<LoginStatesPage />} /> : null}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<LazyPage><DashboardPage /></LazyPage>} />
          <Route path={ROUTES.newDocument} element={<LazyPage><NewDocumentSelectorPage /></LazyPage>} />
          <Route path={ROUTES.documentInputs} element={<LazyPage><CoreInputsPage /></LazyPage>} />
          <Route path="/documents/:documentId/pvp-pvr/select-document" element={<LazyPage><PvpSelectDocumentPage /></LazyPage>} />
          <Route path="/documents/:documentId/pvp-pvr/cover-details" element={<LazyPage><PvpCoverDetailsPage /></LazyPage>} />
          <Route path="/documents/:documentId/pvp-pvr/process-bom" element={<LazyPage><PvpProcessBomPage /></LazyPage>} />
          <Route path={ROUTES.documentPreview} element={<LegacyPreviewRedirect />} />
          <Route path={ROUTES.documentCoverBom} element={<LazyPage><CoverBomPage /></LazyPage>} />
          <Route path={ROUTES.documentStages} element={<LazyPage><SelectStagesPage /></LazyPage>} />
          <Route path={ROUTES.documentStageInput} element={<LazyPage><StageInputPage /></LazyPage>} />
          <Route path={ROUTES.documentGenerate} element={<LazyPage><GenerateSubmitPage /></LazyPage>} />
          <Route path={ROUTES.companyInfo} element={<LazyPage><CompanyInfoPage /></LazyPage>} />
          <Route path={ROUTES.masterData} element={<LazyPage><MasterDataPage /></LazyPage>} />
          <Route path={ROUTES.queue} element={<LazyPage><ReviewQueuePage /></LazyPage>} />
          <Route element={<EmployeeAdminRoute />}>
            <Route path={ROUTES.employees} element={<LazyPage><EmployeesPage /></LazyPage>} />
          </Route>
          <Route path={ROUTES.documentReview} element={<LazyPage><DocumentReviewPage /></LazyPage>} />
          <Route path={ROUTES.documentFinalize} element={<LazyPage><DocumentFinalizePage /></LazyPage>} />
          <Route path="/session" element={<Navigate to="/" replace />} />
          <Route path={ROUTES.versionHistory} element={<LazyPage><VersionHistoryPage /></LazyPage>} />
          <Route path={ROUTES.notifications} element={<LazyPage><NotificationsPage /></LazyPage>} />
          <Route path={ROUTES.auditTrail} element={<LazyPage><AuditTrailPage /></LazyPage>} />
          <Route path={ROUTES.masterDataSetup} element={<LazyPage><MdSetupTypePage /></LazyPage>} />
          <Route path="/master-data-setup/stages" element={<LazyPage><MdStageDocsPage /></LazyPage>} />
          <Route path="/master-data-setup/equipment" element={<LazyPage><MdEquipmentPage /></LazyPage>} />
          <Route path="/master-data-setup/instruments" element={<LazyPage><MdInstrumentPage /></LazyPage>} />
          <Route path="/master-data-setup/batch-docs" element={<LazyPage><MdBatchDocsPage /></LazyPage>} />
          <Route path="/master-data-setup/preview" element={<LazyPage><MdPreviewPage /></LazyPage>} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

function RouteLoadingFallback() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={null} isLoadingUnit title="Loading page" />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="flex min-h-[calc(100vh-var(--topbar-h))] min-w-0 items-center justify-center bg-background px-6 lg:h-full" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-3 rounded-control px-4 py-3 text-small text-subdued">
            <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true" />
            <span>Loading page…</span>
          </div>
        </main>
      </div>
    </div>
  );
}

function isChunkLoadError(error: Error | null): boolean {
  return Boolean(error && /dynamically imported module|dynamic import|loading chunk|chunkloaderror|importing a module script failed/i.test(error.message));
}

/** Old saved/bookmarked preview URLs now skip directly to Cover + BOM. */
function LegacyPreviewRedirect() {
  const { documentId = "" } = useParams();
  return <Navigate to={`/documents/${encodeURIComponent(documentId)}/cover-bom`} replace />;
}
