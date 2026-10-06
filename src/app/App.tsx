import { Navigate, Route, Routes } from "react-router-dom";
import { env } from "../shared/config/env";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { CoreInputsPage } from "../features/core-inputs/pages/CoreInputsPage";
import { NewDocumentSelectorPage } from "../features/new-document/pages/NewDocumentSelectorPage";
import { CoverBomPage } from "../features/bom/pages/CoverBomPage";
import { CompanyInfoPage } from "../features/company/pages/CompanyInfoPage";
import { MasterDataPage } from "../features/master-data/pages/MasterDataPage";
import { DocumentReviewPage } from "../features/review/pages/DocumentReviewPage";
import { ReviewQueuePage } from "../features/review/pages/ReviewQueuePage";
import { StatusBoardPage } from "../features/status-board/pages/StatusBoardPage";
import { VersionHistoryPage } from "../features/version-history/pages/VersionHistoryPage";
import { NotificationsPage } from "../features/notifications/pages/NotificationsPage";
import { AuditTrailPage } from "../features/audit-trail/pages/AuditTrailPage";
import { TypePage as MdSetupTypePage } from "../features/master-data-setup/pages/TypePage";
import { StageDocumentsPage as MdStageDocsPage } from "../features/master-data-setup/pages/StageDocumentsPage";
import { EquipmentListPage as MdEquipmentPage } from "../features/master-data-setup/pages/EquipmentListPage";
import { InstrumentListPage as MdInstrumentPage } from "../features/master-data-setup/pages/InstrumentListPage";
import { BatchDocumentsPage as MdBatchDocsPage } from "../features/master-data-setup/pages/BatchDocumentsPage";
import { PreviewPage as MdPreviewPage } from "../features/master-data-setup/pages/PreviewPage";
import { PreviewPage } from "../features/preview/pages/PreviewPage";
import { GenerateSubmitPage } from "../features/generate/pages/GenerateSubmitPage";
import { StageInputPage } from "../features/stage-input/pages/StageInputPage";
import { SelectStagesPage } from "../features/stages/pages/SelectStagesPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SetPasswordPage } from "../features/auth/pages/SetPasswordPage";
import { EmployeesPage } from "../features/employees/pages/EmployeesPage";
import { LoginStatesPage } from "../features/auth/pages/LoginStatesPage";
import { ProtectedRoute } from "../features/auth/routing/ProtectedRoute";
import { ROUTES } from "./routing/routes";

import { Component, type ReactNode } from "react";

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
              {this.state.error?.message ?? "An unexpected rendering error occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex h-9 items-center justify-center rounded-control bg-primary px-4 text-small font-semibold text-white hover:bg-primary-dark"
            >
              Reload Dashboard
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
          <Route path="/" element={<DashboardPage />} />
          <Route path={ROUTES.newDocument} element={<NewDocumentSelectorPage />} />
          <Route path={ROUTES.documentInputs} element={<CoreInputsPage />} />
          <Route path={ROUTES.documentPreview} element={<PreviewPage />} />
          <Route path={ROUTES.documentCoverBom} element={<CoverBomPage />} />
          <Route path={ROUTES.documentStages} element={<SelectStagesPage />} />
          <Route path={ROUTES.documentStageInput} element={<StageInputPage />} />
          <Route path={ROUTES.documentGenerate} element={<GenerateSubmitPage />} />
          <Route path={ROUTES.companyInfo} element={<CompanyInfoPage />} />
          <Route path={ROUTES.masterData} element={<MasterDataPage />} />
          <Route path={ROUTES.queue} element={<ReviewQueuePage />} />
          <Route path={ROUTES.employees} element={<EmployeesPage />} />
          <Route path={ROUTES.documentReview} element={<DocumentReviewPage />} />
          <Route path={ROUTES.statusBoard} element={<StatusBoardPage />} />
          <Route path={ROUTES.versionHistory} element={<VersionHistoryPage />} />
          <Route path={ROUTES.notifications} element={<NotificationsPage />} />
          <Route path={ROUTES.auditTrail} element={<AuditTrailPage />} />
          <Route path={ROUTES.masterDataSetup} element={<MdSetupTypePage />} />
          <Route path="/master-data-setup/stages" element={<MdStageDocsPage />} />
          <Route path="/master-data-setup/equipment" element={<MdEquipmentPage />} />
          <Route path="/master-data-setup/instruments" element={<MdInstrumentPage />} />
          <Route path="/master-data-setup/batch-docs" element={<MdBatchDocsPage />} />
          <Route path="/master-data-setup/preview" element={<MdPreviewPage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
