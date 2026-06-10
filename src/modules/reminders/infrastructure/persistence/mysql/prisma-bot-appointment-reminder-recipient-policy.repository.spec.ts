import { BotContactChannel, BotContactSuppressionReason } from '@whatsapp-bot/prisma-client';
import type { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AppointmentReminderSuppressionPolicyService } from '../../../application/services/appointment-reminder-suppression-policy.service';
import { PrismaBotAppointmentReminderRecipientPolicyRepository } from './prisma-bot-appointment-reminder-recipient-policy.repository';

type FindManyInput = Parameters<
  PrismaBotService['botContactSuppression']['findMany']
>[0];
type UpdateManyInput = Parameters<
  PrismaBotService['botContactSuppression']['updateMany']
>[0];
type CreateInput = Parameters<PrismaBotService['botContactSuppression']['create']>[0];

function createRepositoryFixture() {
  const findMany = jest
    .fn<Promise<Array<{ reason: BotContactSuppressionReason }>>, [FindManyInput]>()
    .mockResolvedValue([]);
  const updateMany = jest
    .fn<Promise<{ count: number }>, [UpdateManyInput]>()
    .mockResolvedValue({ count: 0 });
  const create = jest
    .fn<Promise<unknown>, [CreateInput]>()
    .mockResolvedValue(undefined);

  const prismaBot = {
    botContactSuppression: {
      findMany,
      updateMany,
      create,
    },
  } as unknown as PrismaBotService;

  const suppressionPolicyService: Pick<
    AppointmentReminderSuppressionPolicyService,
    | 'getPatientScopedBlockingReasons'
    | 'getPhoneScopedBlockingReasons'
    | 'resolve'
    | 'resolveHighestPriority'
  > = {
    getPhoneScopedBlockingReasons: jest.fn().mockReturnValue([
      BotContactSuppressionReason.UNKNOWN_PERSON,
      BotContactSuppressionReason.INVALID_PHONE,
      BotContactSuppressionReason.MANUAL_BLOCK,
    ]),
    getPatientScopedBlockingReasons: jest.fn().mockReturnValue([
      BotContactSuppressionReason.MANUAL_BLOCK,
    ]),
    resolve: jest.fn().mockReturnValue({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON' as const,
    }),
    resolveHighestPriority: jest.fn().mockReturnValue({
      kind: 'ALLOW_CONTACT',
    }),
  };

  const repository = new PrismaBotAppointmentReminderRecipientPolicyRepository(
    prismaBot,
    suppressionPolicyService as AppointmentReminderSuppressionPolicyService,
  );

  return {
    repository,
    findMany,
    updateMany,
    create,
    suppressionPolicyService,
  };
}

describe('PrismaBotAppointmentReminderRecipientPolicyRepository', () => {
  it('matches reminder suppressions across legacy and E164 phone formats', async () => {
    const { repository, findMany, suppressionPolicyService } =
      createRepositoryFixture();
    findMany.mockResolvedValue([
      { reason: BotContactSuppressionReason.UNKNOWN_PERSON },
    ]);
    suppressionPolicyService.resolveHighestPriority = jest.fn().mockReturnValue({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON',
    });

    const result = await repository.resolveReminderContactSuppression({
      patientLegacyUserId: 77,
      phone: '573001234567',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channel: BotContactChannel.WHATSAPP,
          active: true,
          scope: 'APPOINTMENT_NOTIFICATIONS',
          OR: [
            {
              phone: {
                in: ['573001234567', '3001234567'],
              },
              reason: {
                in: [
                  BotContactSuppressionReason.UNKNOWN_PERSON,
                  BotContactSuppressionReason.INVALID_PHONE,
                  BotContactSuppressionReason.MANUAL_BLOCK,
                ],
              },
            },
            {
              patientLegacyUserId: 77,
              reason: {
                in: [BotContactSuppressionReason.MANUAL_BLOCK],
              },
            },
          ],
        },
      }),
    );
    expect(suppressionPolicyService.resolveHighestPriority).toHaveBeenCalledWith(
      [BotContactSuppressionReason.UNKNOWN_PERSON],
    );
    expect(result).toEqual({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON',
    });
  });

  it('allows reminder contact when only a survey opt-out suppression is found', async () => {
    const { repository, findMany, suppressionPolicyService } =
      createRepositoryFixture();
    findMany.mockResolvedValue([
      { reason: BotContactSuppressionReason.OPT_OUT_SURVEY },
    ]);
    suppressionPolicyService.resolveHighestPriority = jest.fn().mockReturnValue({
      kind: 'ALLOW_CONTACT',
    });

    const result = await repository.resolveReminderContactSuppression({
      patientLegacyUserId: 77,
      phone: '573001234567',
    });

    expect(result).toEqual({
      kind: 'ALLOW_CONTACT',
    });
  });

  it('uses the centralized policy reason lists when resolving reminder suppressions', async () => {
    const { repository, findMany, suppressionPolicyService } =
      createRepositoryFixture();
    findMany.mockResolvedValue([
      { reason: BotContactSuppressionReason.MANUAL_BLOCK },
    ]);
    suppressionPolicyService.resolveHighestPriority = jest.fn().mockReturnValue({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'MANUAL_BLOCK',
    });

    await repository.resolveReminderContactSuppression({
      patientLegacyUserId: 77,
      phone: '3001234567',
    });

    expect(
      suppressionPolicyService.getPhoneScopedBlockingReasons,
    ).toHaveBeenCalled();
    expect(
      suppressionPolicyService.getPatientScopedBlockingReasons,
    ).toHaveBeenCalled();
    expect(suppressionPolicyService.resolveHighestPriority).toHaveBeenCalledWith(
      [BotContactSuppressionReason.MANUAL_BLOCK],
    );
  });

  it('resolves deterministic priority when multiple suppressions coexist', async () => {
    const { repository, findMany, suppressionPolicyService } =
      createRepositoryFixture();
    findMany.mockResolvedValue([
      { reason: BotContactSuppressionReason.UNKNOWN_PERSON },
      { reason: BotContactSuppressionReason.MANUAL_BLOCK },
      { reason: BotContactSuppressionReason.INVALID_PHONE },
    ]);
    suppressionPolicyService.resolveHighestPriority = jest.fn().mockReturnValue({
      kind: 'BLOCK_INVALID_PHONE',
    });

    const result = await repository.resolveReminderContactSuppression({
      patientLegacyUserId: 77,
      phone: '3001234567',
    });

    expect(suppressionPolicyService.resolveHighestPriority).toHaveBeenCalledWith(
      [
        BotContactSuppressionReason.UNKNOWN_PERSON,
        BotContactSuppressionReason.MANUAL_BLOCK,
        BotContactSuppressionReason.INVALID_PHONE,
      ],
    );
    expect(result).toEqual({
      kind: 'BLOCK_INVALID_PHONE',
    });
  });

  it('clears unknown-person suppressions for both phone formats', async () => {
    const { repository, updateMany } = createRepositoryFixture();
    updateMany.mockResolvedValue({ count: 2 });

    const result = await repository.clearUnknownPersonSuppression({
      patientLegacyUserId: 77,
      phone: '573001234567',
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channel: BotContactChannel.WHATSAPP,
          active: true,
          reason: BotContactSuppressionReason.UNKNOWN_PERSON,
          scope: 'APPOINTMENT_NOTIFICATIONS',
          patientLegacyUserId: 77,
          phone: {
            in: ['573001234567', '3001234567'],
          },
        },
        data: {
          active: false,
        },
      }),
    );
    expect(result).toBe(true);
  });

  it('updates existing unknown-person suppressions before creating new ones', async () => {
    const { repository, updateMany, create } = createRepositoryFixture();
    updateMany.mockResolvedValue({ count: 1 });

    await repository.upsertUnknownPersonSuppression({
      patientLegacyUserId: 77,
      phone: '3001234567',
      notes: 'Patient rejected phone ownership via reminder verification.',
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientLegacyUserId: 77,
          phone: {
            in: ['3001234567', '573001234567'],
          },
          channel: BotContactChannel.WHATSAPP,
          reason: BotContactSuppressionReason.UNKNOWN_PERSON,
          scope: 'APPOINTMENT_NOTIFICATIONS',
        },
        data: {
          active: true,
          notes: 'Patient rejected phone ownership via reminder verification.',
        },
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new unknown-person suppression when no active record matches', async () => {
    const { repository, updateMany, create } = createRepositoryFixture();
    updateMany.mockResolvedValue({ count: 0 });

    await repository.upsertUnknownPersonSuppression({
      patientLegacyUserId: 77,
      phone: '3001234567',
      notes: 'Patient rejected phone ownership via reminder verification.',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          patientLegacyUserId: 77,
          phone: '3001234567',
          channel: BotContactChannel.WHATSAPP,
          reason: BotContactSuppressionReason.UNKNOWN_PERSON,
          scope: 'APPOINTMENT_NOTIFICATIONS',
          active: true,
          notes: 'Patient rejected phone ownership via reminder verification.',
        },
      }),
    );
  });
});
