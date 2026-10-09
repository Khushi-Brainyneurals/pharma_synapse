/** Normalize the human-readable stage values used by master data. */
export function normalizeStage(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Either side may be the more descriptive value: master data may carry a suffix
 * ("granulation-1"), while the stage label may be longer ("Dispensing of Raw Material").
 * Only the backend `stage` value is compared; other row fields are intentionally ignored.
 */
export function isStageMatch(masterStage: unknown, currentStage: unknown): boolean {
  const normalizedMasterStage = normalizeStage(masterStage);
  const normalizedCurrentStage = normalizeStage(currentStage);

  return Boolean(
    normalizedMasterStage
      && normalizedCurrentStage
      && (
        normalizedMasterStage.includes(normalizedCurrentStage)
        || normalizedCurrentStage.includes(normalizedMasterStage)
      ),
  );
}

export function filterByStage<T extends { stage?: unknown }>(
  rows: T[],
  currentStage: unknown,
): T[] {
  return rows.filter((row) => isStageMatch(row.stage, currentStage));
}
