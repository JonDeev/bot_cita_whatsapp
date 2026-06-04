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

  function buildEnabledRepository(columns: string[]) {
    process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE = 'true';
    const query = jest
      .fn()
      .mockResolvedValueOnce(
        columns.map((columnName) => ({ COLUMN_NAME: columnName })),
      )
      .mockResolvedValueOnce({ affectedRows: 1 });
    const release = jest.fn();
    const end = jest.fn().mockResolvedValue(undefined);
    const getConnection = jest.fn().mockResolvedValue({ query, release });

    createPool.mockReturnValue({ getConnection, end });

    const repository = new MariadbLegacyPatientContactDetailsRepository();
    return { repository, query, release, end };
  }

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

  it('updates phone verification timestamp without confirmacion_telefono', async () => {
    const { repository, query, release, end } = buildEnabledRepository([
      'Teléfono',
      'Telefono Secundario',
      'email',
      'CorreoElectrónico',
      'telefono_verificado_en',
      'correo_verificado_en',
      'IdUsuario',
    ]);

    const result = await repository.updatePatientContactDetails({
      patientId: 10,
      mode: 'PHONE',
      nextPrimaryPhone: '3014445566',
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('telefono_verificado_en'),
      expect.arrayContaining(['3014445566', 10]),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining('confirmacion_telefono'),
      expect.any(Array),
    );
    expect(release).toHaveBeenCalledTimes(1);

    await repository.onModuleDestroy();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('updates email verification timestamp without confirmacion_telefono', async () => {
    const { repository, query } = buildEnabledRepository([
      'Teléfono',
      'Telefono Secundario',
      'email',
      'CorreoElectrónico',
      'telefono_verificado_en',
      'correo_verificado_en',
      'IdUsuario',
    ]);

    const result = await repository.updatePatientContactDetails({
      patientId: 10,
      mode: 'EMAIL',
      nextPrimaryEmail: 'nuevo@example.com',
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('correo_verificado_en'),
      expect.arrayContaining(['nuevo@example.com', 10]),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining('confirmacion_telefono'),
      expect.any(Array),
    );
  });

  it('updates both verification timestamps in one SQL statement', async () => {
    const { repository, query } = buildEnabledRepository([
      'Teléfono',
      'Telefono Secundario',
      'email',
      'CorreoElectrónico',
      'telefono_verificado_en',
      'correo_verificado_en',
      'IdUsuario',
    ]);

    const result = await repository.updatePatientContactDetails({
      patientId: 10,
      mode: 'BOTH',
      nextPrimaryPhone: '3014445566',
      phoneBackupToSecondary: '3001234567',
      nextPrimaryEmail: 'nuevo@example.com',
      emailBackupToSecondary: 'anterior@example.com',
    });

    expect(result).toBe('UPDATED');
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('telefono_verificado_en'),
      expect.arrayContaining([
        '3014445566',
        '3001234567',
        'nuevo@example.com',
        'anterior@example.com',
        10,
      ]),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('correo_verificado_en'),
      expect.any(Array),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining('confirmacion_telefono'),
      expect.any(Array),
    );
  });
});
