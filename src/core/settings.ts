/** localStorage that fails quietly where it's unavailable, like some private windows. */
export function readSetting(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The setting still applies for this visit.
  }
}
