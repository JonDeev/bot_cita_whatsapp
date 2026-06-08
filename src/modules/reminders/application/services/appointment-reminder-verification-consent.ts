export const APPOINTMENT_REMINDER_VERIFICATION_CONSENT_SOURCE =
  'REMINDER_PHONE_VERIFICATION_TEMPLATE';

export function buildAppointmentReminderVerificationConsentText(
  patientName: string,
): string {
  const resolvedPatientName = patientName.trim() || 'Paciente';

  return (
    `Hola ${resolvedPatientName}. Somos IPS SISM.\n\n` +
    'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.\n\n' +
    'Su salud en buenas manos.'
  );
}
