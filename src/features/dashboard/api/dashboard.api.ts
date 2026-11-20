import { httpClient } from "../../../shared/api/httpClient";
import {
  normalizeDocumentItem,
  type DocumentItem,
  type DocumentStatusCard,
} from "../../documents/api/documents.api";
import type { DashboardScope } from "../access";

export interface DashboardDocument extends DocumentItem {
  /** Who last touched the document — shown on the company view. */
  last_modified_by: string | null;
}

export interface DashboardData {
  scope: DashboardScope;
  cards: DocumentStatusCard[];
  documents: DashboardDocument[];
  total: number;
}

const DASHBOARD_ENDPOINTS: Record<DashboardScope, string> = {
  personal: "/api/documents/dashboard/me",
  company: "/api/documents/dashboard/company",
};

/** One dashboard: `personal` → GET /dashboard/me, `company` → GET /dashboard/company. */
export async function getDashboard(scope: DashboardScope): Promise<DashboardData> {
  const response = await httpClient.get<any>(DASHBOARD_ENDPOINTS[scope]);
  const data = response?.data ?? {};

  const rawDocuments: any[] = Array.isArray(data.documents)
    ? data.documents
    : Array.isArray(data.items)
      ? data.items
      : [];

  const documents = rawDocuments.map((raw) => ({
    ...normalizeDocumentItem(raw),
    last_modified_by: raw.last_modified_by ?? null,
  }));

  const cards: DocumentStatusCard[] = Array.isArray(data.cards)
    ? data.cards.map((card: any) => ({
        key: String(card.key),
        label: String(card.label),
        count: Number(card.count ?? 0),
      }))
    : [];

  return {
    scope,
    cards,
    documents,
    total: Number(data.total_documents ?? data.total ?? documents.length),
  };
}
