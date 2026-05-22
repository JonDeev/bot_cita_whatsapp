export const PATIENT_CONTACT_CONFIRMATION_OPTION_IDS = {
  CONTINUE: 'patient_contact_confirmation:continue',
  UPDATE_AND_CONTINUE: 'patient_contact_confirmation:update_and_continue',
  FINISH: 'nav_finish',
} as const;

export type PatientContactConfirmationOptionId =
  (typeof PATIENT_CONTACT_CONFIRMATION_OPTION_IDS)[keyof typeof PATIENT_CONTACT_CONFIRMATION_OPTION_IDS];

export function isPatientContactConfirmationOptionId(
  value: string | undefined | null,
): value is PatientContactConfirmationOptionId {
  if (!value) {
    return false;
  }

  return Object.values(PATIENT_CONTACT_CONFIRMATION_OPTION_IDS).includes(
    value as PatientContactConfirmationOptionId,
  );
}
