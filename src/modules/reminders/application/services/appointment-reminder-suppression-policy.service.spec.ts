import { BotContactSuppressionReason } from '@whatsapp-bot/prisma-client';
import { AppointmentReminderSuppressionPolicyService } from './appointment-reminder-suppression-policy.service';

describe('AppointmentReminderSuppressionPolicyService', () => {
  const service = new AppointmentReminderSuppressionPolicyService();

  it('blocks unknown person suppressions', () => {
    expect(
      service.resolve(BotContactSuppressionReason.UNKNOWN_PERSON),
    ).toEqual({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON',
    });
  });

  it('blocks invalid phone suppressions', () => {
    expect(
      service.resolve(BotContactSuppressionReason.INVALID_PHONE),
    ).toEqual({
      kind: 'BLOCK_INVALID_PHONE',
    });
  });

  it('blocks manual suppressions', () => {
    expect(service.resolve(BotContactSuppressionReason.MANUAL_BLOCK)).toEqual({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'MANUAL_BLOCK',
    });
  });

  it('allows survey opt-out suppressions to remain out of reminder policy', () => {
    expect(service.resolve(BotContactSuppressionReason.OPT_OUT_SURVEY)).toEqual(
      {
        kind: 'ALLOW_CONTACT',
      },
    );
  });

  it('exposes the blocking reasons used by reminder suppression queries', () => {
    expect(service.getPhoneScopedBlockingReasons()).toEqual([
      BotContactSuppressionReason.UNKNOWN_PERSON,
      BotContactSuppressionReason.INVALID_PHONE,
      BotContactSuppressionReason.MANUAL_BLOCK,
    ]);
    expect(service.getPatientScopedBlockingReasons()).toEqual([
      BotContactSuppressionReason.MANUAL_BLOCK,
    ]);
  });

  it('prioritizes invalid phone over other blocking reasons', () => {
    expect(
      service.resolveHighestPriority([
        BotContactSuppressionReason.MANUAL_BLOCK,
        BotContactSuppressionReason.INVALID_PHONE,
      ]),
    ).toEqual({
      kind: 'BLOCK_INVALID_PHONE',
    });
  });

  it('prioritizes manual block over unknown person when invalid phone is absent', () => {
    expect(
      service.resolveHighestPriority([
        BotContactSuppressionReason.UNKNOWN_PERSON,
        BotContactSuppressionReason.MANUAL_BLOCK,
      ]),
    ).toEqual({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'MANUAL_BLOCK',
    });
  });

  it('ignores duplicates while preserving deterministic priority', () => {
    expect(
      service.resolveHighestPriority([
        BotContactSuppressionReason.UNKNOWN_PERSON,
        BotContactSuppressionReason.UNKNOWN_PERSON,
      ]),
    ).toEqual({
      kind: 'BLOCK_SUPPRESSED_CONTACT',
      reason: 'UNKNOWN_PERSON',
    });
  });

  it('allows reminder contact when no blocking reason applies', () => {
    expect(service.resolveHighestPriority([])).toEqual({
      kind: 'ALLOW_CONTACT',
    });
    expect(
      service.resolveHighestPriority([
        BotContactSuppressionReason.OPT_OUT_SURVEY,
      ]),
    ).toEqual({
      kind: 'ALLOW_CONTACT',
    });
  });
});
