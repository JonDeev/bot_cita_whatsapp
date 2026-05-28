export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    search.set(key, String(value));
  });

  const asString = search.toString();
  return asString.length > 0 ? `?${asString}` : '';
}
