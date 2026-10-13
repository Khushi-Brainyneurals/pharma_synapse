import { httpClient } from "../../../shared/api/httpClient";

export interface CompanyInfo {
  company_name: string | null;
  address: string | null;
  addresses: CompanyAddress[];
  logo_path: string | null;
  mfg_licence_no: string | null;
  font_name: string | null;
  font_size: number | null;
  line_spacing: number | null;
  header_size: number | null;
  template_no: string | null;
  department: string | null;
  has_logo: boolean;

  /** Name + logo + font all present. Generation is GATED on this. */
  is_complete: boolean;
  /** What's still missing — shown to the QA reviewer, not just a disabled Save. */
  missing: string[];
  updated_by: string | null;
  updated_at: string | null;
  /** Saved-before-and-complete → editing it is a controlled change (needs a reason). */
  is_effective: boolean;
}

export interface CompanyAddress {
  address_id: number;
  address: string;
}

type CompanyInfoResponse = Partial<CompanyInfo> & {
  approval_status?: string | null;
};

export type CompanyInfoUpdate = Partial<
  Pick<
    CompanyInfo,
    | "company_name"
    | "address"
    | "mfg_licence_no"
    | "font_name"
    | "font_size"
    | "line_spacing"
    | "header_size"
    | "template_no"
    | "department"
  >
> & { reason?: string };

/** The document fonts, with their CSS stacks — taken from the design. */
export const FONT_STACKS: Record<string, string> = {
  Arial: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  Calibri: "Calibri, 'Segoe UI', Carlito, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const response = await httpClient.get<CompanyInfoResponse>("/api/company-info");
  return normalizeCompanyInfo(response.data);
}

export async function updateCompanyInfo(payload: CompanyInfoUpdate): Promise<CompanyInfo> {
  const response = await httpClient.put<CompanyInfoResponse>("/api/company-info", payload);
  return normalizeCompanyInfo(response.data);
}

export async function uploadLogo(logo: File): Promise<CompanyInfo> {
  const formData = new FormData();
  formData.append("logo", logo);

  const response = await httpClient.post<CompanyInfoResponse>("/api/company-info/logo", formData);
  return normalizeCompanyInfo(response.data);
}

/**
 * The logo endpoint needs the bearer token, and an <img src> can't send one — nor would
 * a relative path reach the BFF. So it's fetched through the API client and handed to
 * <img> as an object URL. Caller must revoke it.
 */
export async function fetchLogoObjectUrl(): Promise<string | null> {
  try {
    const response = await httpClient.get("/api/company-info/logo", { responseType: "blob" });
    return window.URL.createObjectURL(response.data as Blob);
  } catch {
    return null;
  }
}

function normalizeCompanyInfo(data: CompanyInfoResponse): CompanyInfo {
  const addresses = Array.isArray(data.addresses)
    ? data.addresses.filter(
        (item): item is CompanyAddress =>
          typeof item?.address_id === "number" && typeof item.address === "string",
      )
    : [];
  const primaryAddress = data.address ?? addresses[0]?.address ?? null;
  const logoPath = data.logo_path ?? null;
  const approvalStatus = data.approval_status?.toLowerCase();

  return {
    company_name: data.company_name ?? null,
    address: primaryAddress,
    addresses,
    logo_path: logoPath,
    mfg_licence_no: data.mfg_licence_no ?? null,
    font_name: data.font_name ?? null,
    font_size: data.font_size ?? null,
    line_spacing: data.line_spacing ?? null,
    header_size: data.header_size ?? null,
    template_no: data.template_no ?? null,
    department: data.department ?? null,
    has_logo: data.has_logo ?? Boolean(logoPath),
    is_complete: data.is_complete ?? false,
    missing: Array.isArray(data.missing) ? data.missing : [],
    updated_by: data.updated_by ?? null,
    updated_at: data.updated_at ?? null,
    is_effective: data.is_effective ?? approvalStatus === "approved",
  };
}

export interface CompanyApprovalState {
  category: string;
  product_type: string | null;
  doc_type: string | null;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
}

export async function getCompanyApproval(): Promise<CompanyApprovalState> {
  const response = await httpClient.get<CompanyApprovalState>("/api/company-info/approval");
  return response.data;
}

export async function submitCompanyApproval(): Promise<CompanyApprovalState> {
  const response = await httpClient.post<CompanyApprovalState>("/api/company-info/approval/submit");
  return response.data;
}

export async function decideCompanyApproval(
  decision: "approved" | "rejected",
  reason?: string,
): Promise<CompanyApprovalState> {
  const response = await httpClient.post<CompanyApprovalState>(
    `/api/company-info/approval/decide?decision=${decision}`,
    reason ? { reason } : {},
  );
  return response.data;
}

