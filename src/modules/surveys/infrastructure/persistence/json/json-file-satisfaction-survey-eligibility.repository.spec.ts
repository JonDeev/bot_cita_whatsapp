import { readFile } from 'node:fs/promises';
import { SatisfactionSurveyEligibilitySourceConfigService } from '../../../application/services/satisfaction-survey-eligibility-source-config.service';
import { JsonFileSatisfactionSurveyEligibilityRepository } from './json-file-satisfaction-survey-eligibility.repository';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('JsonFileSatisfactionSurveyEligibilityRepository', () => {
  it('filters rows by date and window', async () => {
    (readFile as jest.Mock).mockResolvedValue(
      JSON.stringify([
        {
          legacyAgendaId: 900001,
          patientLegacyUserId: 700001,
          patientName: 'Paciente Prueba',
          patientPhone: '3043477809',
          appointmentDateIso: '2026-05-11',
          appointmentTimeHhmm: '15:00',
          specialtyName: 'Medicina General',
          doctorName: 'Dr. Prueba',
          siteName: 'Sede Central',
        },
        {
          legacyAgendaId: 900002,
          patientLegacyUserId: 700001,
          patientName: 'Paciente Prueba',
          patientPhone: '3043477809',
          appointmentDateIso: '2026-05-11',
          appointmentTimeHhmm: '15:40',
          specialtyName: 'Medicina General',
          doctorName: 'Dr. Prueba',
          siteName: 'Sede Central',
        },
      ]),
    );

    const configService = {
      getJsonFilePath: jest.fn(
        () => 'ops/fixtures/surveys/eligibility-test.json',
      ),
    } as unknown as SatisfactionSurveyEligibilitySourceConfigService;

    const repository = new JsonFileSatisfactionSurveyEligibilityRepository(
      configService,
    );
    const rows = await repository.findEligibleAppointmentsByWindow({
      surveyDateIso: '2026-05-11',
      windowStartHHmm: '15:00',
      windowEndHHmm: '15:30',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      legacyAgendaId: 900001,
      patientLegacyUserId: 700001,
      appointmentTimeHhmm: '15:00',
    });
  });
});
