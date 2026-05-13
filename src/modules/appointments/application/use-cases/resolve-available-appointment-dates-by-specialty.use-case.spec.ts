import { AppointmentDatePresenterService } from '../services/appointment-date-presenter.service';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from './resolve-available-appointment-dates-by-specialty.use-case';

describe('ResolveAvailableAppointmentDatesBySpecialtyUseCase', () => {
  it('returns up to five unique dates ordered by repository results', async () => {
    const repository = {
      findAvailableDates: jest
        .fn()
        .mockResolvedValue([
          { dateIso: '2026-05-06' },
          { dateIso: '2026-05-06' },
          { dateIso: '2026-05-07' },
          { dateIso: '2026-05-08' },
          { dateIso: '2026-05-09' },
          { dateIso: '2026-05-10' },
          { dateIso: '2026-05-11' },
        ]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-05',
        cutoffTimeHHmm: '12:39',
      }),
    };

    const useCase = new ResolveAvailableAppointmentDatesBySpecialtyUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentDatePresenterService(),
    );

    const result = await useCase.execute({
      specialtyCups: '890201',
      now: new Date('2026-05-05T15:39:00.000Z'),
    });

    expect(repository.findAvailableDates).toHaveBeenCalledWith({
      specialtyCups: '890201',
      cutoffDateIso: '2026-05-05',
      cutoffTimeHHmm: '12:39',
    });
    expect(result).toEqual({
      hasAvailability: true,
      dates: [
        { isoDate: '2026-05-06', displayDate: '06/05/2026' },
        { isoDate: '2026-05-07', displayDate: '07/05/2026' },
        { isoDate: '2026-05-08', displayDate: '08/05/2026' },
        { isoDate: '2026-05-09', displayDate: '09/05/2026' },
        { isoDate: '2026-05-10', displayDate: '10/05/2026' },
      ],
    });
  });

  it('returns failure when specialty cups is missing', async () => {
    const repository = {
      findAvailableDates: jest.fn(),
    };
    const cutoffService = {
      build: jest.fn(),
    };

    const useCase = new ResolveAvailableAppointmentDatesBySpecialtyUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentDatePresenterService(),
    );

    const result = await useCase.execute({
      specialtyCups: '   ',
    });

    expect(result).toEqual({
      hasAvailability: false,
      reason: 'SPECIALTY_CUPS_MISSING',
      dates: [],
    });
    expect(repository.findAvailableDates).not.toHaveBeenCalled();
  });

  it('passes doctor filter when provided', async () => {
    const repository = {
      findAvailableDates: jest
        .fn()
        .mockResolvedValue([{ dateIso: '2026-05-06' }]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-05',
        cutoffTimeHHmm: '12:39',
      }),
    };

    const useCase = new ResolveAvailableAppointmentDatesBySpecialtyUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentDatePresenterService(),
    );

    await useCase.execute({
      specialtyCups: '890201',
      doctorEmployeeCode: 'M001',
    });

    expect(repository.findAvailableDates).toHaveBeenCalledWith({
      specialtyCups: '890201',
      cutoffDateIso: '2026-05-05',
      cutoffTimeHHmm: '12:39',
      doctorEmployeeCode: 'M001',
    });
  });
});
