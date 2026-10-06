import { httpClient } from "../../../shared/api/httpClient";

export interface CompanyInfo {
  company_name: string | null;
  address: string | null;
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
  const response = await httpClient.get<CompanyInfo>("/api/company-info");
  return response.data;
}

export async function updateCompanyInfo(payload: CompanyInfoUpdate): Promise<CompanyInfo> {
  const response = await httpClient.put<CompanyInfo>("/api/company-info", payload);
  return response.data;
}

export async function uploadLogo(logo: File): Promise<CompanyInfo> {
  const formData = new FormData();
  formData.append("logo", logo);

  const response = await httpClient.post<CompanyInfo>("/api/company-info/logo", formData);
  return response.data;
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
