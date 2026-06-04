import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotWhatsappContactConsentRepository } from './prisma-bot-whatsapp-contact-consent.repository';

describe('PrismaBotWhatsappContactConsentRepository', () => {
  it('creates a consent event and upserts one consent row per purpose', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({ id: 12 });
    const transaction = jest.fn().mockImplementation(async (callback) =>
      callback({
        botContactConsentEvent: { create },
        botPatientContactConsent: { upsert },
      }),
    );

    const prismaBot = {
      $transaction: transaction,
    } as unknown as PrismaBotService;

    const repository = new PrismaBotWhatsappContactConsentRepository(prismaBot);
    await repository.recordConsent({
      patientLegacyUserId: 98,
      phone: '573001112233',
      channel: 'WHATSAPP',
      source: 'BOT_POST_BOOKING_PROMPT',
      consentTextSnapshot: 'Autorizo contacto por WhatsApp.',
      response: 'ACCEPTED',
      respondedAtIso: '2026-05-09T10:00:00.000Z',
      purposes: ['APPOINTMENT_NOTIFICATIONS', 'SATISFACTION_SURVEYS'],
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientLegacyUserId_channel_purpose: {
            patientLegacyUserId: 98,
            channel: 'WHATSAPP',
            purpose: 'APPOINTMENT_NOTIFICATIONS',
          },
        },
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientLegacyUserId_channel_purpose: {
            patientLegacyUserId: 98,
            channel: 'WHATSAPP',
            purpose: 'SATISFACTION_SURVEYS',
          },
        },
      }),
    );
  });

  it('returns current consent snapshot for a patient and purpose', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      patientLegacyUserId: 98,
      phone: '573001112233',
      granted: true,
      grantedAt: new Date('2026-05-12T10:00:00.000Z'),
      revokedAt: null,
    });
    const prismaBot = {
      botPatientContactConsent: {
        findUnique,
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotWhatsappContactConsentRepository(prismaBot);
    const result = await repository.findConsentByPatientAndPurpose({
      patientLegacyUserId: 98,
      channel: 'WHATSAPP',
      purpose: 'APPOINTMENT_NOTIFICATIONS',
    });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientLegacyUserId_channel_purpose: {
            patientLegacyUserId: 98,
            channel: 'WHATSAPP',
            purpose: 'APPOINTMENT_NOTIFICATIONS',
          },
        },
      }),
    );
    expect(result).toEqual({
      patientLegacyUserId: 98,
      phone: '573001112233',
      channel: 'WHATSAPP',
      purpose: 'APPOINTMENT_NOTIFICATIONS',
      granted: true,
      grantedAtIso: '2026-05-12T10:00:00.000Z',
      revokedAtIso: null,
    });
  });
});
