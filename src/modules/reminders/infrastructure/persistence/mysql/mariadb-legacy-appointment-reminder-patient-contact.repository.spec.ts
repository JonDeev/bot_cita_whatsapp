const createPool = jest.fn();

jest.mock('mariadb', () => ({
  __esModule: true,
  default: {
    createPool,
  },
}));

import { MariadbLegacyAppointmentReminderPatientContactRepository } from './mariadb-legacy-appointment-reminder-patient-contact.repository';

describe('MariadbLegacyAppointmentReminderPatientContactRepository', () => {
  const envBackup = {
    ALLOW_LEGACY_PATIENT_CONTACT_WRITE:
      process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE,
    SISM_CONTACT_WRITE_DATABASE_URL:
      process.env.SISM_CONTACT_WRITE_DATABASE_URL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE = 'true';
    process.env.SISM_CONTACT_WRITE_DATABASE_URL =
      'mysql://writer:pwd@host:3306/sism';
  });

  afterAll(() => {
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE =
      envBackup.ALLOW_LEGACY_PATIENT_CONTACT_WRITE;
    process.env.SISM_CONTACT_WRITE_DATABASE_URL =
      envBackup.SISM_CONTACT_WRITE_DATABASE_URL;
  });

  function buildRepository() {
    const query = jest.fn().mockResolvedValue({ affectedRows: 1 });
    const release = jest.fn();
    const end = jest.fn().mockResolvedValue(undefined);
    const getConnection = jest.fn().mockResolvedValue({ query, release });

    createPool.mockReturnValue({ getConnection, end });

    return {
      repository: new MariadbLegacyAppointmentReminderPatientContactRepository(),
      query,
      release,
      end,
    };
  }

  it('marks phone verification without confirmacion_telefono', async () => {
    const { repository, query, release, end } = buildRepository();

    const result = await repository.markPhoneVerified({
      patientLegacyUserId: 10,
      verifiedAtIso: '2026-05-10T10:00:00.000Z',
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('telefono_verificado_en'),
      [new Date('2026-05-10T10:00:00.000Z'), 10],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('confirmacion_telefono'),
      expect.anything(),
    );
    expect(release).toHaveBeenCalledTimes(1);

    await repository.onModuleDestroy();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('clears phone verification without confirmacion_telefono', async () => {
    const { repository, query } = buildRepository();

    const result = await repository.clearPhoneAndVerification({
      patientLegacyUserId: 10,
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('telefono_verificado_en'),
      [10],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('confirmacion_telefono'),
      expect.anything(),
    );
  });
});
