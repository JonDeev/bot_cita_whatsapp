import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacySatisfactionSurveyEligibilityRepository } from './prisma-legacy-satisfaction-survey-eligibility.repository';

describe('PrismaLegacySatisfactionSurveyEligibilityRepository', () => {
  it('reads the patient phone from the physical Teléfono column', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacySatisfactionSurveyEligibilityRepository(
      prisma,
    );

    await repository.findEligibleAppointmentsByWindow({
      surveyDateIso: '2026-06-23',
      windowStartHHmm: '07:00',
      windowEndHHmm: '08:30',
      limit: 50,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    const query = (prisma.$queryRaw as jest.Mock).mock.calls[0][0];
    const queryText =
      typeof query?.strings?.join === 'function'
        ? query.strings.join('')
        : String(query);

    expect(queryText).toContain('u.`Teléfono`');
    expect(queryText).toContain("TRIM(COALESCE(a.Estado, '')) = 'Atendido'");
  });

  it('normalizes legacy integer identifiers returned as strings', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          legacyAgendaId: '42939',
          patientLegacyUserId: '11560',
          patientName: '  Adriana Bot  ',
          patientPhone: ' 3001234567 ',
          appointmentDateIso: '2026-06-23',
          appointmentTimeHhmm: '07:00',
          specialtyName: ' Medicina General ',
          doctorName: ' Dra. Example ',
          siteName: ' Sede Norte ',
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacySatisfactionSurveyEligibilityRepository(
      prisma,
    );

    const rows = await repository.findEligibleAppointmentsByWindow({
      surveyDateIso: '2026-06-23',
      windowStartHHmm: '07:00',
      windowEndHHmm: '08:30',
      limit: 50,
    });

    expect(rows).toEqual([
      {
        legacyAgendaId: 42939,
        patientLegacyUserId: 11560,
        patientName: 'Adriana Bot',
        patientPhone: '3001234567',
        appointmentDateIso: '2026-06-23',
        appointmentTimeHhmm: '07:00',
        specialtyName: 'Medicina General',
        doctorName: 'Dra. Example',
        siteName: 'Sede Norte',
      },
    ]);
  });
});
