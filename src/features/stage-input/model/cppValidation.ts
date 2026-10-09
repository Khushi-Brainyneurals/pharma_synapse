export function areCppValuesComplete(
  parameters: string[],
  values: Record<string, string> | undefined,
): boolean {
  return parameters.every((parameter) => {
    const value = values?.[parameter];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function areScopedCppValuesComplete(
  parameters: string[],
  scopeKeys: string[],
  valuesByScope: Record<string, Record<string, string>>,
): boolean {
  return scopeKeys.every((scopeKey) => areCppValuesComplete(parameters, valuesByScope[scopeKey]));
}
