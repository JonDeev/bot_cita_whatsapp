import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from './resolve-available-appointment-times-by-specialty-and-date.use-case';

describe('ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase', () => {
  it('returns nine closest unique times with hasMore and next cursor', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockResolvedValue([
        { slotRef: '101', timeHHmm: '08:00' },
        { slotRef: '102', timeHHmm: '08:00' },
        { slotRef: '103', timeHHmm: '09:00' },
        { slotRef: '104', timeHHmm: '10:00' },
        { slotRef: '105', timeHHmm: '11:00' },
        { slotRef: '106', timeHHmm: '12:00' },
        { slotRef: '107', timeHHmm: '13:00' },
        { slotRef: '108', timeHHmm: '14:00' },
        { slotRef: '109', timeHHmm: '15:00' },
        { slotRef: '110', timeHHmm: '16:00' },
      ]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-06',
        cutoffTimeHHmm: '07:30',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      now: new Date('2026-05-06T10:00:00.000Z'),
    });

    expect(repository.findAvailableTimesByDate).toHaveBeenCalledWith({
      specialtyCups: '890201',
      dateIso: '2026-05-06',
      minimumTimeHHmm: '07:30',
      afterTimeHHmmExclusive: undefined,
      maxResults: 10,
    });
    expect(result).toEqual({
      hasAvailability: true,
      times: [
        { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
        { slotRef: '103', timeHHmm: '09:00', displayTime: '09:00 AM' },
        { slotRef: '104', timeHHmm: '10:00', displayTime: '10:00 AM' },
        { slotRef: '105', timeHHmm: '11:00', displayTime: '11:00 AM' },
        { slotRef: '106', timeHHmm: '12:00', displayTime: '12:00 PM' },
        { slotRef: '107', timeHHmm: '13:00', displayTime: '01:00 PM' },
        { slotRef: '108', timeHHmm: '14:00', displayTime: '02:00 PM' },
        { slotRef: '109', timeHHmm: '15:00', displayTime: '03:00 PM' },
        { slotRef: '110', timeHHmm: '16:00', displayTime: '04:00 PM' },
      ],
      hasMore: false,
      nextCursorTimeHHmm: undefined,
    });
  });

  it('sets hasMore when there is at least one extra unique hour', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockResolvedValue([
        { slotRef: '101', timeHHmm: '08:00' },
        { slotRef: '102', timeHHmm: '09:00' },
        { slotRef: '103', timeHHmm: '10:00' },
        { slotRef: '104', timeHHmm: '11:00' },
        { slotRef: '105', timeHHmm: '12:00' },
        { slotRef: '106', timeHHmm: '13:00' },
        { slotRef: '107', timeHHmm: '14:00' },
        { slotRef: '108', timeHHmm: '15:00' },
        { slotRef: '109', timeHHmm: '16:00' },
        { slotRef: '110', timeHHmm: '17:00' },
      ]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-06',
        cutoffTimeHHmm: '07:30',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
    });

    expect(result).toEqual({
      hasAvailability: true,
      times: [
        { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
        { slotRef: '102', timeHHmm: '09:00', displayTime: '09:00 AM' },
        { slotRef: '103', timeHHmm: '10:00', displayTime: '10:00 AM' },
        { slotRef: '104', timeHHmm: '11:00', displayTime: '11:00 AM' },
        { slotRef: '105', timeHHmm: '12:00', displayTime: '12:00 PM' },
        { slotRef: '106', timeHHmm: '13:00', displayTime: '01:00 PM' },
        { slotRef: '107', timeHHmm: '14:00', displayTime: '02:00 PM' },
        { slotRef: '108', timeHHmm: '15:00', displayTime: '03:00 PM' },
        { slotRef: '109', timeHHmm: '16:00', displayTime: '04:00 PM' },
      ],
      hasMore: true,
      nextCursorTimeHHmm: '16:00',
    });
  });

  it('keeps hasMore on second page when more unique times still exist', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockImplementation((filters: { afterTimeHHmmExclusive?: string }) => {
        if (!filters.afterTimeHHmmExclusive) {
          return Promise.resolve([
            { slotRef: '001', timeHHmm: '00:00' },
            { slotRef: '002', timeHHmm: '01:00' },
            { slotRef: '003', timeHHmm: '02:00' },
            { slotRef: '004', timeHHmm: '03:00' },
            { slotRef: '005', timeHHmm: '04:00' },
            { slotRef: '006', timeHHmm: '05:00' },
            { slotRef: '007', timeHHmm: '06:00' },
            { slotRef: '008', timeHHmm: '07:00' },
            { slotRef: '009', timeHHmm: '08:00' },
            { slotRef: '010', timeHHmm: '09:00' },
          ]);
        }

        return Promise.resolve([
          { slotRef: '011', timeHHmm: '09:00' },
          { slotRef: '012', timeHHmm: '10:00' },
          { slotRef: '013', timeHHmm: '11:00' },
          { slotRef: '014', timeHHmm: '12:00' },
          { slotRef: '015', timeHHmm: '13:00' },
          { slotRef: '016', timeHHmm: '14:00' },
          { slotRef: '017', timeHHmm: '15:00' },
          { slotRef: '018', timeHHmm: '16:00' },
          { slotRef: '019', timeHHmm: '17:00' },
          { slotRef: '020', timeHHmm: '18:00' },
        ]);
      }),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-05',
        cutoffTimeHHmm: '00:00',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    const firstPage = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
    });
    const secondPage = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      afterTimeHHmmExclusive:
        firstPage.hasAvailability ? firstPage.nextCursorTimeHHmm ?? null : null,
    });

    expect(firstPage).toMatchObject({
      hasAvailability: true,
      hasMore: true,
      nextCursorTimeHHmm: '08:00',
    });
    expect(secondPage).toMatchObject({
      hasAvailability: true,
      hasMore: true,
      nextCursorTimeHHmm: '17:00',
    });
  });

  it('uses midnight threshold when selected date is after the cutoff date', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockResolvedValue([{ slotRef: '201', timeHHmm: '06:00' }]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-06',
        cutoffTimeHHmm: '18:30',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-07',
    });

    expect(repository.findAvailableTimesByDate).toHaveBeenCalledWith({
      specialtyCups: '890201',
      dateIso: '2026-05-07',
      minimumTimeHHmm: '00:00',
      afterTimeHHmmExclusive: undefined,
      maxResults: 10,
    });
  });

  it('applies pagination cursor when requesting next page', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockResolvedValue([
        { slotRef: '301', timeHHmm: '16:30' },
        { slotRef: '302', timeHHmm: '17:00' },
      ]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-06',
        cutoffTimeHHmm: '07:30',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      afterTimeHHmmExclusive: '15:00',
    });

    expect(repository.findAvailableTimesByDate).toHaveBeenCalledWith({
      specialtyCups: '890201',
      dateIso: '2026-05-06',
      minimumTimeHHmm: '07:30',
      afterTimeHHmmExclusive: '15:00',
      maxResults: 10,
    });
    expect(result).toEqual({
      hasAvailability: true,
      times: [
        { slotRef: '301', timeHHmm: '16:30', displayTime: '04:30 PM' },
        { slotRef: '302', timeHHmm: '17:00', displayTime: '05:00 PM' },
      ],
      hasMore: false,
      nextCursorTimeHHmm: undefined,
    });
  });

  it('returns failure when specialty cups or appointment date is missing', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn(),
    };
    const cutoffService = {
      build: jest.fn(),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    const missingSpecialty = await useCase.execute({
      specialtyCups: '  ',
      appointmentDateIso: '2026-05-06',
    });
    const missingDate = await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '   ',
    });

    expect(missingSpecialty).toEqual({
      hasAvailability: false,
      reason: 'SPECIALTY_CUPS_MISSING',
      times: [],
    });
    expect(missingDate).toEqual({
      hasAvailability: false,
      reason: 'APPOINTMENT_DATE_MISSING',
      times: [],
    });
    expect(repository.findAvailableTimesByDate).not.toHaveBeenCalled();
  });

  it('passes doctor filter when requesting times for a selected doctor', async () => {
    const repository = {
      findAvailableTimesByDate: jest.fn().mockResolvedValue([{ slotRef: '301', timeHHmm: '16:30' }]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-06',
        cutoffTimeHHmm: '07:30',
      }),
    };
    const useCase = new ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase(
      repository as any,
      cutoffService as any,
      new AppointmentTimePresenterService(),
    );

    await useCase.execute({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      doctorEmployeeCode: 'M001',
    });

    expect(repository.findAvailableTimesByDate).toHaveBeenCalledWith({
      specialtyCups: '890201',
      dateIso: '2026-05-06',
      minimumTimeHHmm: '07:30',
      afterTimeHHmmExclusive: undefined,
      doctorEmployeeCode: 'M001',
      maxResults: 10,
    });
  });
});
