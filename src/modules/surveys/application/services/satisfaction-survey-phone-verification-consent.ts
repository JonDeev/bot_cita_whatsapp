export const SATISFACTION_SURVEY_PHONE_VERIFICATION_CONSENT_SOURCE =
  'SURVEY_PHONE_VERIFICATION_TEMPLATE';

export function buildSatisfactionSurveyPhoneVerificationConsentText(
  patientName: string,
): string {
  const resolvedPatientName = patientName.trim() || 'Paciente';

  return (
    `Hola ${resolvedPatientName}. Somos IPS SISM.\n\n` +
    'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir encuestas de satisfaccion de este paciente.\n\n' +
    'Su salud en buenas manos.'
  );
}
