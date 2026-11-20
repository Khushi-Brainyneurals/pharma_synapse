import { httpClient } from "../../../shared/api/httpClient";

export interface ModuleItem {
  key: string;
  label: string;
  description: string;
  document_types: string[];
  roles_defined: boolean;
  login_available: boolean;
}

export interface ModuleSection {
  key: string;
  name: string;
  modules: ModuleItem[];
}

export interface ModulesResponse {
  module_login_available: boolean;
  sections: ModuleSection[];
}

export interface ModuleRole {
  key: string;
  label: string;
  access: string;
}

export interface ModuleRolesResponse {
  module: string;
  module_login_available: boolean;
  roles: ModuleRole[];
}

export async function getModules(): Promise<ModulesResponse> {
  const { data } = await httpClient.get<ModulesResponse>("/api/modules");
  return data;
}

export async function getModuleRoles(moduleKey: string): Promise<ModuleRolesResponse> {
  const { data } = await httpClient.get<ModuleRolesResponse>(
    `/api/modules/${encodeURIComponent(moduleKey)}/roles`,
  );
  return data;
}
