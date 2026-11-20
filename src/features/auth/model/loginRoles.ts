export interface LoginRoleGroup {
  key: string;
  label: string;
  roles: { key: string; label: string }[];
}

/** Group the backend's role list without maintaining a second list of role data. */
export function groupApiRoles(roles: { key: string; label: string; access: string }[]): LoginRoleGroup[] {
  const grouped = new Map<string, { key: string; label: string }[]>();
  for (const role of roles) {
    const access = role.access || "work";
    const group = grouped.get(access) ?? [];
    group.push({ key: role.key, label: role.label });
    grouped.set(access, group);
  }

  return Array.from(grouped, ([access, groupRoles]) => ({
    key: access,
    label: access === "work" ? "Work here" : access === "view" ? "View only" : access,
    roles: groupRoles,
  }));
}
