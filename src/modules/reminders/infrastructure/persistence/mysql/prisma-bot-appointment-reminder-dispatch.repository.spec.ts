import {
  BotAppointmentReminderDispatchStatus,
  Prisma,
} from '@whatsapp-bot/prisma-client';
import { PrismaBotAppointmentReminderDispatchRepository } from './prisma-bot-appointment-reminder-dispatch.repository';

describe('PrismaBotAppointmentReminderDispatchRepository', () => {
  it('claims due dispatches with lock ownership and returns mapped rows', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 11 }, { id: 12 }])
      .mockResolvedValueOnce([
        {
          id: 11,
          legacyAgendaId: 3001,
          patientLegacyUserId: 77,
          conversationKey: 'whatsapp:1:573001234567',
          recipientPhoneRaw: '3001234567',
          recipientPhoneE164: '573001234567',
          appointmentStartsAt: new Date('2026-06-06T12:00:00.000Z'),
          scheduledFor: new Date('2026-06-05T12:00:00.000Z'),
          reminderType: 'APPOINTMENT_24H',
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          templateName: 'recordatorio_cita_24h',
          verificationTemplateName: 'verificacion_telefono_paciente',
          metaMessageId: null,
          verificationMessageId: null,
          attempts: 0,
          nextAttemptAt: null,
          lockAcquiredAt: new Date('2026-06-05T10:00:00.000Z'),
          lockExpiresAt: new Date('2026-06-05T10:05:00.000Z'),
          lockedBy: 'worker:test',
          lockVersion: 4,
          verificationTokenHash: null,
          verificationRequestedAt: null,
          verificationExpiresAt: null,
          sentAt: null,
        },
      ]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const prismaBot = {
      botAppointmentReminderDispatch: {
        findMany,
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const result = await repository.claimDueDispatches({
      runAtIso: '2026-06-05T10:00:00.000Z',
      workerId: 'worker:test',
      lockTtlSeconds: 300,
      limit: 50,
      restrictToDispatchIds: [11, 12],
    });

    const claimCalls = updateMany.mock.calls as Array<[unknown]>;
    const claimCall = claimCalls[0]?.[0] as {
      where: {
        id: { in: number[] };
        status: {
          in: BotAppointmentReminderDispatchStatus[];
        };
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lockedBy: string;
      };
    };

    expect(claimCall.where).toMatchObject({
      id: { in: [11, 12] },
      status: {
        in: [
          BotAppointmentReminderDispatchStatus.PENDING,
          BotAppointmentReminderDispatchStatus.FAILED,
        ],
      },
    });
    expect(claimCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.LOCKED,
      lockedBy: 'worker:test',
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 11,
        status: BotAppointmentReminderDispatchStatus.LOCKED,
        lockedBy: 'worker:test',
      }),
    ]);
  });

  it('recovers expired locks and increments lock version', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 21 }, { id: 22 }]);
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });

    const prismaBot = {
      botAppointmentReminderDispatch: {
        findMany,
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const recovered = await repository.recoverExpiredLocks({
      runAtIso: '2026-06-05T10:00:00.000Z',
      limit: 25,
    });

    const recoverCalls = updateMany.mock.calls as Array<[unknown]>;
    const recoverCall = recoverCalls[0]?.[0] as {
      where: {
        id: { in: number[] };
        status: BotAppointmentReminderDispatchStatus;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lockVersion: {
          increment: number;
        };
      };
    };

    expect(recoverCall.where).toMatchObject({
      id: { in: [21, 22] },
      status: BotAppointmentReminderDispatchStatus.LOCKED,
    });
    expect(recoverCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.PENDING,
      lockVersion: {
        increment: 1,
      },
    });
    expect(recovered).toBe(2);
  });

  it('transitions verification pending dispatches to expired', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 31 }]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const prismaBot = {
      botAppointmentReminderDispatch: {
        findMany,
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const expired = await repository.expirePendingPhoneVerifications({
      runAtIso: '2026-06-05T10:00:00.000Z',
      limit: 10,
    });

    const expireCalls = updateMany.mock.calls as Array<[unknown]>;
    const expireCall = expireCalls[0]?.[0] as {
      where: {
        id: { in: number[] };
        status: BotAppointmentReminderDispatchStatus;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
      };
    };

    expect(expireCall.where).toMatchObject({
      id: { in: [31] },
      status: BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
    });
    expect(expireCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_EXPIRED,
    });
    expect(expired).toBe(1);
  });

  it('marks a locked dispatch as PHONE_VERIFICATION_PENDING with CAS fields', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked = await repository.markVerificationPending({
      dispatchId: 41,
      expectedLockVersion: 6,
      workerId: 'worker:test',
      verificationTokenHash: 'hash-41',
      verificationMessageId: 'wamid-41',
      verificationRequestedAtIso: '2026-06-05T10:00:00.000Z',
      verificationExpiresAtIso: '2026-06-05T13:00:00.000Z',
    });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const call = calls[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus;
        lockedBy: string;
        lockVersion: number;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        verificationTokenHash: string;
        verificationMessageId: string;
        lockAcquiredAt: null;
        lockExpiresAt: null;
        lockedBy: null;
      };
    };

    expect(call.where).toMatchObject({
      id: 41,
      status: BotAppointmentReminderDispatchStatus.LOCKED,
      lockedBy: 'worker:test',
      lockVersion: 6,
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
      verificationTokenHash: 'hash-41',
      verificationMessageId: 'wamid-41',
      lockAcquiredAt: null,
      lockExpiresAt: null,
      lockedBy: null,
    });
    expect(marked).toBe(true);
  });

  it('marks a locked dispatch as SENT with CAS fields', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked = await repository.markSent({
      dispatchId: 51,
      expectedLockVersion: 3,
      workerId: 'worker:test',
      metaMessageId: 'wamid-51',
      sentAtIso: '2026-06-05T10:00:00.000Z',
    });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const call = calls[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus;
        lockedBy: string;
        lockVersion: number;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        metaMessageId: string;
        lastError: null;
        nextAttemptAt: null;
        lockedBy: null;
      };
    };

    expect(call.where).toMatchObject({
      id: 51,
      status: BotAppointmentReminderDispatchStatus.LOCKED,
      lockedBy: 'worker:test',
      lockVersion: 3,
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SENT,
      metaMessageId: 'wamid-51',
      lastError: null,
      nextAttemptAt: null,
      lockedBy: null,
    });
    expect(marked).toBe(true);
  });

  it('marks a locked dispatch as PAUSED_HOLD with CAS fields', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked = await repository.markPausedHold({
      dispatchId: 52,
      expectedLockVersion: 3,
      workerId: 'worker:test',
      reason: 'emergency_pause_active',
    });

    const call = (updateMany.mock.calls as Array<[unknown]>)[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus;
        lockedBy: string;
        lockVersion: number;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lastError: string;
        lockAcquiredAt: null;
        lockExpiresAt: null;
        lockedBy: null;
      };
    };

    expect(call.where).toMatchObject({
      id: 52,
      status: BotAppointmentReminderDispatchStatus.LOCKED,
      lockedBy: 'worker:test',
      lockVersion: 3,
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
      lastError: 'emergency_pause_active',
      lockAcquiredAt: null,
      lockExpiresAt: null,
      lockedBy: null,
    });
    expect(marked).toBe(true);
  });

  it('marks post-verification reminder as sent from PHONE_VERIFICATION_PENDING', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked = await repository.markPostVerificationSent({
      dispatchId: 61,
      metaMessageId: 'wamid-61',
      sentAtIso: '2026-06-05T10:00:00.000Z',
    });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const call = calls[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        metaMessageId: string;
        lastError: null;
      };
    };

    expect(call.where).toMatchObject({
      id: 61,
      status: BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SENT,
      metaMessageId: 'wamid-61',
      lastError: null,
    });
    expect(marked).toBe(true);
  });

  it('compensates post-verification reminder as sent after uncertain ownership', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked =
      await repository.markPostVerificationSentAfterUncertainOwnership({
        dispatchId: 61,
        metaMessageId: 'wamid-61',
        sentAtIso: '2026-06-05T10:00:00.000Z',
      });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const call = calls[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus[];
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        metaMessageId: string;
      };
    };

    expect(call.where).toMatchObject({
      id: 61,
      status: {
        in: [
          BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
          BotAppointmentReminderDispatchStatus.PENDING,
          BotAppointmentReminderDispatchStatus.LOCKED,
          BotAppointmentReminderDispatchStatus.SENT,
        ],
      },
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SENT,
      metaMessageId: 'wamid-61',
    });
    expect(marked).toBe(true);
  });

  it('marks post-verification reminder as skipped for invalid phone, handoff and opt-in guards', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const invalidPhoneMarked = await repository.markPostVerificationSkipped({
      dispatchId: 61,
      status: 'SKIPPED_INVALID_PHONE',
      reason: 'INVALID_PHONE',
    });

    const handoffMarked = await repository.markPostVerificationSkipped({
      dispatchId: 62,
      status: 'SKIPPED_HANDOFF_ACTIVE',
    });

    const optInMarked = await repository.markPostVerificationSkipped({
      dispatchId: 63,
      status: 'SKIPPED_NO_OPT_IN',
      reason: 'Opt-in missing after phone confirmation.',
    });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const firstCall = calls[0]?.[0] as {
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lastError: string | null;
      };
    };
    const secondCall = calls[1]?.[0] as {
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lastError: string | null;
      };
    };
    const thirdCall = calls[2]?.[0] as {
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lastError: string | null;
      };
    };

    expect(firstCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SKIPPED_INVALID_PHONE,
      lastError: 'INVALID_PHONE',
    });
    expect(secondCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SKIPPED_HANDOFF_ACTIVE,
      lastError: null,
    });
    expect(thirdCall.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.SKIPPED_NO_OPT_IN,
      lastError: 'Opt-in missing after phone confirmation.',
    });
    expect(invalidPhoneMarked).toBe(true);
    expect(handoffMarked).toBe(true);
    expect(optInMarked).toBe(true);
  });

  it('marks post-verification reminder as PAUSED_HOLD when emergency pause is active', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const marked = await repository.markPostVerificationPausedHold({
      dispatchId: 64,
      reason: 'emergency_pause_active',
    });

    const call = (updateMany.mock.calls as Array<[unknown]>)[0]?.[0] as {
      where: {
        id: number;
        status: BotAppointmentReminderDispatchStatus;
      };
      data: {
        status: BotAppointmentReminderDispatchStatus;
        lastError: string;
      };
    };

    expect(call.where).toMatchObject({
      id: 64,
      status: BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
    });
    expect(call.data).toMatchObject({
      status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
      lastError: 'emergency_pause_active',
    });
    expect(marked).toBe(true);
  });

  it('marks inbound dedup rows as processed', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaBot = {
      botWebhookInboundDedup: {
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    await repository.markInboundDedupProcessed({
      provider: 'META_WHATSAPP',
      inboundMessageId: 'wamid.inbound.2',
      buttonPayloadId: 'appt_reminder_reject:token',
      processedAtIso: '2026-06-05T10:00:00.000Z',
      resultStatus: 'PROCESSED_REJECTED',
    });

    const calls = updateMany.mock.calls as Array<[unknown]>;
    const call = calls[0]?.[0] as {
      where: {
        provider: string;
        inboundMessageId: string;
        buttonPayloadId: string;
      };
      data: {
        resultStatus: string;
      };
    };

    expect(call.where).toMatchObject({
      provider: 'META_WHATSAPP',
      inboundMessageId: 'wamid.inbound.2',
      buttonPayloadId: 'appt_reminder_reject:token',
    });
    expect(call.data).toMatchObject({
      resultStatus: 'PROCESSED_REJECTED',
    });
  });

  it('returns false when inbound dedup hits unique constraint', async () => {
    const prismaBot = {
      botWebhookInboundDedup: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Duplicate dedup row', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const accepted = await repository.recordInboundDedup({
      provider: 'META_WHATSAPP',
      inboundMessageId: 'wamid.inbound.1',
      buttonPayloadId: 'appt_reminder_confirm:token',
      receivedAtIso: '2026-06-05T10:00:00.000Z',
      resultStatus: 'RECEIVED',
    });

    expect(accepted).toBe(false);
  });

  it('releases paused hold rows back to pending in due order', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 81 }, { id: 82 }]);
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prismaBot = {
      botAppointmentReminderDispatch: {
        findMany,
        updateMany,
      },
    };

    const repository = new PrismaBotAppointmentReminderDispatchRepository(
      prismaBot as never,
    );

    const released = await repository.releasePausedHolds({
      runAtIso: '2026-06-07T12:00:00.000Z',
      limit: 25,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
      },
      take: 25,
    });
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: { in: [81, 82] },
        status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
      },
      data: {
        status: BotAppointmentReminderDispatchStatus.PENDING,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    expect(released).toEqual([81, 82]);
  });
});
