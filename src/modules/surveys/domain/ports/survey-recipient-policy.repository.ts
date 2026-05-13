export interface SurveyRecipientPolicyRepository {
  hasGrantedSatisfactionSurveyConsent(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean>;
  isPhoneSuppressedForSatisfactionSurveys(input: {
    phone: string;
  }): Promise<boolean>;
}
