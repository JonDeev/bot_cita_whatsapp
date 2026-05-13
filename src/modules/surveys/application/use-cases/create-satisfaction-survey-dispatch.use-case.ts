import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import {
  type CreateSurveyDispatchResult,
  type SurveyDispatchAppointmentSnapshot,
  type SurveyDispatchRepository,
} from '../../domain/ports/survey-dispatch.repository';
import { SURVEY_DISPATCH_REPOSITORY } from '../../domain/surveys.tokens';
import { SATISFACTION_SURVEY_DEFINITION } from '../services/satisfaction-survey-definition.constants';
import { SurveyWhatsappPhoneNormalizerService } from '../services/survey-whatsapp-phone-normalizer.service';

export interface CreateSatisfactionSurveyDispatchInput {
  patientLegacyUserId: number;
  patientName: string;
  patientPhone: string;
  surveyDateIso: string;
  triggerType: string;
  windowStartIso: string;
  windowEndIso: string;
  expiresAtIso: string;
  appointments: readonly SurveyDispatchAppointmentSnapshot[];
}

@Injectable()
export class CreateSatisfactionSurveyDispatchUseCase {
  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    private readonly auditService: AuditService,
    private readonly phoneNormalizer: SurveyWhatsappPhoneNormalizerService,
  ) {}

  async execute(
    input: CreateSatisfactionSurveyDispatchInput,
  ): Promise<CreateSurveyDispatchResult> {
    this.validateInput(input);

    const sanitizedPhone = this.phoneNormalizer.sanitize(input.patientPhone);
    const patientPhoneE164 =
      this.phoneNormalizer.toWhatsappRecipient(sanitizedPhone);
    const dedupeKey = `survey:${input.patientLegacyUserId}:${input.surveyDateIso}`;

    const result = await this.surveyDispatchRepository.createOrGetDailyDispatch(
      {
        surveyDefinitionCode: SATISFACTION_SURVEY_DEFINITION.CODE,
        surveyDefinitionVersion: SATISFACTION_SURVEY_DEFINITION.VERSION,
        patientLegacyUserId: input.patientLegacyUserId,
        patientName: input.patientName.trim(),
        patientPhone: sanitizedPhone,
        patientPhoneE164,
        surveyDateIso: input.surveyDateIso,
        triggerType: input.triggerType,
        windowStartIso: input.windowStartIso,
        windowEndIso: input.windowEndIso,
        expiresAtIso: input.expiresAtIso,
        dedupeKey,
        appointments: input.appointments,
      },
    );

    const action = result.wasCreated
      ? 'survey.dispatch.created'
      : 'survey.dispatch.reused';

    await this.auditService.record(action, {
      dispatchId: result.dispatch.id,
      patientLegacyUserId: result.dispatch.patientLegacyUserId,
      surveyDate: result.dispatch.surveyDateIso,
      appointmentCount: result.dispatch.appointments.length,
      status: result.dispatch.status,
      wasCreated: result.wasCreated,
    });

    return result;
  }

  private validateInput(input: CreateSatisfactionSurveyDispatchInput): void {
    if (
      !Number.isInteger(input.patientLegacyUserId) ||
      input.patientLegacyUserId <= 0
    ) {
      throw new BadRequestException(
        'Patient legacy user id must be a positive integer.',
      );
    }

    if (!input.patientName?.trim()) {
      throw new BadRequestException('Patient name is required.');
    }

    if (
      !this.phoneNormalizer.isValidLegacyColombianMobile(input.patientPhone)
    ) {
      throw new BadRequestException(
        'Patient phone must be a valid Colombian mobile number.',
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.surveyDateIso)) {
      throw new BadRequestException('Survey date must use YYYY-MM-DD format.');
    }

    if (!input.triggerType?.trim()) {
      throw new BadRequestException('Trigger type is required.');
    }

    this.assertIsoDateTime(input.windowStartIso, 'Window start');
    this.assertIsoDateTime(input.windowEndIso, 'Window end');
    this.assertIsoDateTime(input.expiresAtIso, 'Expiration');

    if (input.appointments.length === 0) {
      throw new BadRequestException(
        'At least one appointment is required to create a survey dispatch.',
      );
    }

    for (const appointment of input.appointments) {
      if (
        !Number.isInteger(appointment.legacyAgendaId) ||
        appointment.legacyAgendaId <= 0
      ) {
        throw new BadRequestException(
          'Appointment legacy agenda id must be a positive integer.',
        );
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appointmentDateIso)) {
        throw new BadRequestException(
          'Appointment date must use YYYY-MM-DD format.',
        );
      }

      if (!/^\d{2}:\d{2}$/.test(appointment.appointmentTimeHhmm)) {
        throw new BadRequestException(
          'Appointment time must use HH:MM format.',
        );
      }
    }
  }

  private assertIsoDateTime(value: string, label: string): void {
    if (!value || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException(`${label} must be a valid ISO datetime.`);
    }
  }
}
