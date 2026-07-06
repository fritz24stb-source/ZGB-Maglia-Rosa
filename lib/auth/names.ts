export const DISPLAY_NAME_MAX_LENGTH = 80;

export function normalizeDisplayName(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("Name fehlt.");
  }

  if (normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(
      `Name darf maximal ${DISPLAY_NAME_MAX_LENGTH} Zeichen lang sein.`,
    );
  }

  return normalized;
}

export function normalizeDisplayNameKey(value: string) {
  return normalizeDisplayName(value).toLocaleLowerCase("de");
}
