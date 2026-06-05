export const PATIENT_SEX_CODES = {
  FEMALE: 'F',
  MALE: 'M',
  INDETERMINATE: 'I',
} as const;

export type PatientSexCode =
  (typeof PATIENT_SEX_CODES)[keyof typeof PATIENT_SEX_CODES];

const PATIENT_SEX_CODE_SET = new Set<PatientSexCode>([
  PATIENT_SEX_CODES.FEMALE,
  PATIENT_SEX_CODES.MALE,
  PATIENT_SEX_CODES.INDETERMINATE,
]);

export function normalizePatientSexCode(
  rawValue: string | null | undefined,
): PatientSexCode | null {
  const normalized = (rawValue ?? '').trim().toUpperCase();
  if (!PATIENT_SEX_CODE_SET.has(normalized as PatientSexCode)) {
    return null;
  }

  return normalized as PatientSexCode;
}
