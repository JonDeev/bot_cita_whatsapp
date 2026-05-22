export const PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS = {
  PHONE: 'patient_contact_update_field:phone',
  EMAIL: 'patient_contact_update_field:email',
  BOTH: 'patient_contact_update_field:both',
  BACK: 'nav_back',
  MAIN_MENU: 'nav_main_menu',
  FINISH: 'nav_finish',
} as const;

export type PatientContactUpdateFieldOptionId =
  (typeof PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS)[keyof typeof PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS];

export function isPatientContactUpdateFieldOptionId(
  value: string | undefined | null,
): value is PatientContactUpdateFieldOptionId {
  if (!value) {
    return false;
  }

  return Object.values(PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS).includes(
    value as PatientContactUpdateFieldOptionId,
  );
}
