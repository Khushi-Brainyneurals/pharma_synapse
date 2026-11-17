const STORAGE_KEY = "ps-module";

/** Remembers the module someone opened from the module map, for the session. */
export function rememberModule(key: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* storage unavailable: the module only travels in the sign-in URL */
  }
}

/** The module chosen on the module map, if any. */
export function getRememberedModule(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
