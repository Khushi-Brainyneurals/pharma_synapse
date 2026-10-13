import { httpClient } from "../../../shared/api/httpClient";

export interface Employee {
  user_id: string;
  roles: string[];
  department: string;
  unit: string;
  address_id: number;
  address: string;
  status: string;
  created_at: string;
}

export interface EmployeeCreate {
  user_id: string;
  roles: string[];
  department: string;
  unit: string;
  address_id: number;
  password: string;
  status: string;
}

export type EmployeeUpdate = Omit<EmployeeCreate, "password">;

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

interface EmployeeUpdateResponse {
  message?: string;
  data?: Employee;
}

export async function listEmployees(): Promise<Employee[]> {
  const response = await httpClient.get<unknown>("/employee");

  if (!Array.isArray(response.data)) {
    throw new Error("EMPLOYEE_LIST_RESPONSE_INVALID");
  }

  return response.data as Employee[];
}

export async function createEmployee(payload: EmployeeCreate): Promise<Employee | null> {
  const response = await httpClient.post<Employee | EmployeeUpdateResponse>(
    "/employee/register",
    payload,
  );
  return employeeFromMutationResponse(response.data);
}

export async function updateEmployee(
  id: string,
  payload: EmployeeUpdate,
): Promise<Employee | null> {
  const response = await httpClient.patch<Employee | EmployeeUpdateResponse>(
    `/employee/${encodeURIComponent(id)}/update`,
    payload,
  );
  return employeeFromMutationResponse(response.data);
}

export async function deleteEmployee(id: string): Promise<void> {
  await httpClient.delete(`/employee/${encodeURIComponent(id)}/delete`);
}

export async function changeEmployeePassword(
  id: string,
  payload: ChangePasswordRequest,
): Promise<void> {
  await httpClient.post(`/employee/${encodeURIComponent(id)}/change-password`, payload);
}

/** No token needed — login refuses an expired password, so one cannot be obtained. */
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

function employeeFromMutationResponse(
  data: Employee | EmployeeUpdateResponse,
): Employee | null {
  if (isEmployee(data)) {
    return data;
  }

  return data.data && isEmployee(data.data) ? data.data : null;
}

function isEmployee(value: unknown): value is Employee {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Employee).user_id === "string" &&
    Array.isArray((value as Employee).roles)
  );
}
