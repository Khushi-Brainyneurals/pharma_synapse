import { httpClient } from "../../../shared/api/httpClient";

export interface AuditRecord {
  id: number | string;
  actor_id: string | null;
  actor_role: string | null;
  action: string | null;
  result: string | null;
  timestamp: string | null;
  entity: string | null;
  entity_id: string | null;
  before: unknown | null;
  after: unknown | null;
  reason: string | null;
  ip_address: string | null;
  session_id: number | null;
}

export interface AuditFilters {
  actor_id?: string;
  actor_role?: string;
  action?: string;
  result?: string;
  entity?: string;
  entity_id?: string;
  ip_address?: string;
  session_id?: number;
  start_date?: string;
  end_date?: string;
}

/** Keep only values accepted by the audit endpoint; blank controls are not serialized. */
export function buildAuditParams(filters: AuditFilters): AuditFilters {
  const params: AuditFilters = {};

  for (const key of [
    "actor_id",
    "actor_role",
    "action",
    "result",
    "entity",
    "entity_id",
    "ip_address",
    "start_date",
    "end_date",
  ] as const) {
    const value = filters[key]?.trim();
    if (value) params[key] = value;
  }

  if (Number.isSafeInteger(filters.session_id)) {
    params.session_id = filters.session_id;
  }

  return params;
}

export async function getAuditLogs(
  filters: AuditFilters = {},
  signal?: AbortSignal,
): Promise<AuditRecord[]> {
  const response = await httpClient.get<unknown>("/audit", {
    params: buildAuditParams(filters),
    signal,
  });

  if (!Array.isArray(response.data)) {
    throw new Error("AUDIT_LIST_RESPONSE_INVALID");
  }

  return response.data.map(normalizeAuditRecord);
}

function normalizeAuditRecord(value: unknown): AuditRecord {
  const record = isRecord(value) ? value : {};
  const id = record.id;
  const sessionId = record.session_id;

  return {
    id:
      typeof id === "string" || typeof id === "number"
        ? id
        : id == null
          ? ""
          : String(id),
    actor_id: nullableString(record.actor_id),
    actor_role: nullableString(record.actor_role),
    action: nullableString(record.action),
    result: nullableString(record.result),
    timestamp: nullableString(record.timestamp),
    entity: nullableString(record.entity),
    entity_id: nullableString(record.entity_id),
    before: record.before ?? null,
    after: record.after ?? null,
    reason: nullableString(record.reason),
    ip_address: nullableString(record.ip_address),
    session_id: typeof sessionId === "number" && Number.isSafeInteger(sessionId) ? sessionId : null,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The page declares Asia/Kolkata as its instance timezone. Preserve that offset in the
 * request and make the end boundary inclusive through the final millisecond of the day.
 */
export function auditDateTime(
  calendarDate: string,
  boundary: "start" | "end",
): string | undefined {
  if (!isCalendarDate(calendarDate)) return undefined;

  const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";
  return `${calendarDate}T${time}+05:30`;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
