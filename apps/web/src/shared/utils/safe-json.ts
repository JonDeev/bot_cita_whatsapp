export function safeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '-';
  }
}
