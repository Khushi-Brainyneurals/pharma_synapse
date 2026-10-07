import { httpClient } from "../../../shared/api/httpClient";

/**
 * Account status is its OWN axis — never a document lifecycle hue.
 * active · disabled · locked · must_change · expired
 */
export type AccountStatus =
  | "active"
  | "disabled"
  | "locked"
  | "must_change"
  | "expired";

export interface Employee {
  id: number;
  /** Identity is the User ID. No email — this is what every audit entry hangs on. */
  username: string;
  name: string | null;
  role: string;
  department: string | null;
  unit_id: string | null;
  unit_name: string | null;
  designation: string | null;
  account_status: AccountStatus;
  password_age_days: number;
  is_active: boolean;
  /** Owns documents still in flight — blocks a disable until they're reassigned. */
  in_flight_count: number;
  created_at: string | null;
}

export interface InFlightDocument {
  document_id: string;
  bmr_number: string | null;
  status: string;
}

export interface TempPasswordResponse {
  user: Employee;
  /** Shown once. Never retrievable again. */
  temporary_password: string;
}

export interface EmployeeCreate {
  username: string;
  name?: string;
  role: string;
  department?: string;
  designation?: string;
  unit_id?: string;
  unit_name?: string;
  step_up_password: string;
}

export async function listEmployees(): Promise<Employee[]> {
  const response = await httpClient.get<Employee[]>("/api/users");
  return response.data;
}

/** An Admin cannot mint Admins — those are "managed by the Super Admin". */
export async function getAssignableRoles(): Promise<string[]> {
  const response = await httpClient.get<string[]>("/api/users/assignable-roles");
  return response.data;
}

export async function createEmployee(payload: EmployeeCreate): Promise<TempPasswordResponse> {
  const response = await httpClient.post<TempPasswordResponse>("/api/users", payload);
  return response.data;
}

export async function getInFlight(id: number): Promise<InFlightDocument[]> {
  const response = await httpClient.get<InFlightDocument[]>(`/api/users/${id}/in-flight`);
  return response.data;
}

export async function disableEmployee(
  id: number,
  reason: string,
  stepUpPassword: string,
): Promise<Employee> {
  const response = await httpClient.post<Employee>(`/api/users/${id}/disable`, {
    reason,
    step_up_password: stepUpPassword,
  });

  return response.data;
}

export async function enableEmployee(id: number, stepUpPassword: string): Promise<Employee> {
  const response = await httpClient.post<Employee>(`/api/users/${id}/enable`, {
    step_up_password: stepUpPassword,
  });

  return response.data;
}

export async function resetEmployeePassword(
  id: number,
  stepUpPassword: string,
): Promise<TempPasswordResponse> {
  const response = await httpClient.post<TempPasswordResponse>(
    `/api/users/${id}/reset-password`,
    { step_up_password: stepUpPassword },
  );

  return response.data;
}

export async function unlockEmployee(id: number, stepUpPassword: string): Promise<Employee> {
  const response = await httpClient.post<Employee>(`/api/users/${id}/unlock`, {
    step_up_password: stepUpPassword,
  });

  return response.data;
}

/** No token needed — login refuses an expired password, so one can't be obtained. */
export async function changeExpiredPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await httpClient.post("/password/change-expired", {
    username,
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export const ROLE_LABELS: Record<string, string> = {
  preparer: "Prepared By",
  reviewer_qa: "Reviewer QA",
  reviewer_pr: "Reviewer PR",
  approver: "Approver",
  admin: "Admin",
  superadmin: "Super Admin",
};
