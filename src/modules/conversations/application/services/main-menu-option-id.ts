export const MAIN_MENU_OPTION_IDS = {
  REQUEST_APPOINTMENT: 'main_menu_request_appointment',
  CHECK_APPOINTMENTS: 'main_menu_check_appointments',
  CANCEL_OR_RESCHEDULE: 'main_menu_cancel_or_reschedule',
  UPDATE_CONTACT: 'main_menu_update_contact',
  HUMAN_HANDOFF: 'main_menu_human_handoff',
  FAQ: 'main_menu_faq',
} as const;

export type MainMenuOptionId = (typeof MAIN_MENU_OPTION_IDS)[keyof typeof MAIN_MENU_OPTION_IDS];
