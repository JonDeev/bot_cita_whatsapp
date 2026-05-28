export const parseCookieHeader = (
  rawCookieHeader: string | undefined,
): Record<string, string> => {
  if (!rawCookieHeader || rawCookieHeader.trim().length === 0) {
    return {};
  }

  const result: Record<string, string> = {};
  const parts = rawCookieHeader.split(';');
  for (const part of parts) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    result[key] = decodeURIComponent(value);
  }

  return result;
};
