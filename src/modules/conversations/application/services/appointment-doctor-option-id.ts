const APPOINTMENT_DOCTOR_OPTION_PREFIX = 'appointment_doctor:';

export function buildAppointmentDoctorOptionId(employeeCode: string): string {
  return `${APPOINTMENT_DOCTOR_OPTION_PREFIX}${employeeCode}`;
}

export function parseAppointmentDoctorOptionId(optionId: string): string | null {
  if (!optionId.startsWith(APPOINTMENT_DOCTOR_OPTION_PREFIX)) {
    return null;
  }

  const employeeCode = optionId.slice(APPOINTMENT_DOCTOR_OPTION_PREFIX.length).trim();
  if (!employeeCode) {
    return null;
  }

  return employeeCode;
}
