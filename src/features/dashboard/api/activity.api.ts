import { httpClient } from "../../../shared/api/httpClient";

export interface ActivityDay {
  date: string;
  documents_generated: number;
  total_seconds: number;
  measured_documents: number;
  average_seconds: number;
}

export interface DocumentActivity {
  module: string;
  site_id: number | null;
  start_date: string;
  end_date: string;
  timezone: string;
  documents_created: number;
  status_counts: Record<string, number>;
  documents_generated: number;
  total_generation_seconds: number;
  average_generation_seconds: number;
  missing_duration_count: number;
  daily: ActivityDay[];
}

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** GET /api/documents/dashboard/activity — documents created by status and generated per day. */
export async function getDocumentActivity(startDate: string, endDate: string): Promise<DocumentActivity> {
  const response = await httpClient.get<any>("/api/documents/dashboard/activity", {
    params: { start_date: startDate, end_date: endDate },
  });
  const data = response?.data ?? {};
  const statusCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data.status_counts ?? {})) {
    statusCounts[key] = num(value);
  }
  return {
    module: String(data.module ?? ""),
    site_id: data.site_id ?? null,
    start_date: String(data.start_date ?? startDate),
    end_date: String(data.end_date ?? endDate),
    timezone: String(data.timezone ?? "UTC"),
    documents_created: num(data.documents_created),
    status_counts: statusCounts,
    documents_generated: num(data.documents_generated),
    total_generation_seconds: num(data.total_generation_seconds),
    average_generation_seconds: num(data.average_generation_seconds),
    missing_duration_count: num(data.missing_duration_count),
    daily: Array.isArray(data.daily)
      ? data.daily.map((day: any) => ({
          date: String(day.date ?? ""),
          documents_generated: num(day.documents_generated),
          total_seconds: num(day.total_seconds),
          measured_documents: num(day.measured_documents),
          average_seconds: num(day.average_seconds),
        }))
      : [],
  };
}
