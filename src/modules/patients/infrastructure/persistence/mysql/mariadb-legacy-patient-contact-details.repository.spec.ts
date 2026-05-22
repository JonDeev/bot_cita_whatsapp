const createPool = jest.fn();

jest.mock('mariadb', () => ({
  __esModule: true,
  default: {
    createPool,
  },
}));

import { MariadbLegacyPatientContactDetailsRepository } from './mariadb-legacy-patient-contact-details.repository';

describe('MariadbLegacyPatientContactDetailsRepository', () => {
  const envBackup = {
    ALLOW_LEGACY_PATIENT_CONTACT_WRITE:
      process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE,
    SISM_CONTACT_WRITE_DATABASE_URL:
      process.env.SISM_CONTACT_WRITE_DATABASE_URL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE = 'false';
    process.env.SISM_CONTACT_WRITE_DATABASE_URL =
      'mysql://writer:pwd@host:3306/sism';
  });

  afterAll(() => {
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE =
      envBackup.ALLOW_LEGACY_PATIENT_CONTACT_WRITE;
    process.env.SISM_CONTACT_WRITE_DATABASE_URL =
      envBackup.SISM_CONTACT_WRITE_DATABASE_URL;
  });

  it('returns WRITE_DISABLED when guardrail is disabled', async () => {
    const repository = new MariadbLegacyPatientContactDetailsRepository();

    const result = await repository.updatePatientContactDetails({
      patientId: 10,
      mode: 'PHONE',
      nextPrimaryPhone: '3014445566',
    });

    expect(result).toBe('WRITE_DISABLED');
    expect(createPool).not.toHaveBeenCalled();
  });

  it('updates both phone and email in a single SQL statement when enabled', async () => {
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE = 'true';
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { COLUMN_NAME: 'Teléfono' },
        { COLUMN_NAME: 'Telefono Secundario' },
        { COLUMN_NAME: 'email' },
        { COLUMN_NAME: 'CorreoElectrónico' },
        { COLUMN_NAME: 'confirmacion_telefono' },
        { COLUMN_NAME: 'IdUsuario' },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 });
    const release = jest.fn();
    const end = jest.fn().mockResolvedValue(undefined);
    const getConnection = jest.fn().mockResolvedValue({ query, release });

    createPool.mockReturnValue({ getConnection, end });

    const repository = new MariadbLegacyPatientContactDetailsRepository();

    const result = await repository.updatePatientContactDetails({
      patientId: 10,
      mode: 'BOTH',
      nextPrimaryPhone: '3014445566',
      phoneBackupToSecondary: '3001234567',
      nextPrimaryEmail: 'nuevo@example.com',
      emailBackupToSecondary: 'anterior@example.com',
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE `usuarios` SET'),
      expect.arrayContaining([
        '3014445566',
        '3001234567',
        'nuevo@example.com',
        'anterior@example.com',
        'ambos',
        10,
      ]),
    );
    expect(release).toHaveBeenCalledTimes(1);

    await repository.onModuleDestroy();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
