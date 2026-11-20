const STORAGE_KEY = "ps-module";
const NAME_STORAGE_KEY = "ps-module-name";
const DESCRIPTION_STORAGE_KEY = "ps-module-description";

/**
 * Remembers the module someone opened from the module map.
 *
 * Kept in localStorage (not sessionStorage) so it lives as long as the auth session,
 * which is also in localStorage: closing the tab and coming back still signs the user
 * in automatically, and the module must still be there. Cleared on sign-out.
 */
export function rememberModule(key: string, name?: string, description?: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
    if (name) localStorage.setItem(NAME_STORAGE_KEY, name);
    if (description) localStorage.setItem(DESCRIPTION_STORAGE_KEY, description);
  } catch {
    /* storage unavailable: the module only travels in the sign-in URL */
  }
}

export function getRememberedModuleDescription(): string | null {
  try {
    return localStorage.getItem(DESCRIPTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The selected module's API-provided label, for existing post-login page titles. */
export function getRememberedModuleName(): string | null {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The module chosen on the module map, if any. */
export function getRememberedModule(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Forgets the chosen module, so the next person to sign in on this browser starts fresh. */
export function clearRememberedModule() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_STORAGE_KEY);
    localStorage.removeItem(DESCRIPTION_STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
