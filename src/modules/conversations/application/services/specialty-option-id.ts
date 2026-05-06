const SPECIALTY_OPTION_PREFIX = 'specialty:';

export function buildSpecialtyOptionId(specialtyCode: string): string {
  return `${SPECIALTY_OPTION_PREFIX}${specialtyCode}`;
}

export function parseSpecialtyOptionId(optionId: string): string | null {
  if (!optionId.startsWith(SPECIALTY_OPTION_PREFIX)) {
    return null;
  }

  const specialtyCode = optionId.slice(SPECIALTY_OPTION_PREFIX.length).trim();
  if (!specialtyCode) {
    return null;
  }

  return specialtyCode;
}
