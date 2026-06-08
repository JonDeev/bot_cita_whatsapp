import {
  formatReminderRuntimeApplyModeLabel,
  formatReminderRuntimeGlobalStateLabel,
  formatReminderRuntimeSectionLabel,
  formatReminderRuntimeSendModeLabel,
} from '../src/features/reminder-settings/reminder-settings.types';

describe('reminder-settings types helpers', () => {
  it('formats section and runtime labels', () => {
    expect(formatReminderRuntimeSectionLabel('primary')).toBe('Controles primarios');
    expect(formatReminderRuntimeSectionLabel('advanced')).toBe('Configuracion avanzada');
    expect(formatReminderRuntimeSectionLabel('protected')).toBe('Configuracion protegida');
    expect(formatReminderRuntimeApplyModeLabel('immediate')).toBe('Aplica de inmediato');
    expect(formatReminderRuntimeApplyModeLabel('restart_required')).toBe(
      'Requiere reinicio controlado',
    );
    expect(formatReminderRuntimeSendModeLabel('live')).toBe('Live');
    expect(formatReminderRuntimeSendModeLabel('mock')).toBe('Mock');
  });

  it('derives global state from stored runtime snapshot', () => {
    const paused = formatReminderRuntimeGlobalStateLabel({
      stored: {
        sendMode: 'live',
        sendRolloutPercent: '50',
        emergencyPauseEnabled: 'enabled',
        dispatchBatchSize: '50',
        eligibilityLimit: '250',
        syncEnabled: 'enabled',
        dispatchEnabled: 'enabled',
        queueEnabled: 'enabled',
        syncIntervalMs: '300000',
        recoverySweepIntervalMs: '300000',
        workerConcurrency: '2',
        lockTtlSeconds: '300',
        lockHeartbeatIntervalMs: '60000',
        minConfirmationHours: '4',
      },
      effectiveHotReloadable: {
        sendMode: 'live',
        sendRolloutPercent: '50',
        emergencyPauseEnabled: 'enabled',
        dispatchBatchSize: '50',
        eligibilityLimit: '250',
        lockTtlSeconds: '300',
        lockHeartbeatIntervalMs: '60000',
        minConfirmationHours: '4',
      },
      metadata: {
        version: 1,
        lastUpdatedAtIso: '2026-06-06T00:00:00.000Z',
        lastUpdatedByAdminUserId: 1,
        emergencyPauseReason: null,
      },
      runtimeApplication: {
        restartScopedFieldKeys: ['syncEnabled'],
        restartScopedApplyNote: 'Requiere reinicio controlado',
      },
      permissions: {
        canEditPrimary: true,
        canEditAdvanced: false,
        canEditProtected: false,
        canToggleEmergencyPause: true,
      },
    });

    expect(paused.label).toBe('Pausado');
    expect(paused.tone).toBe('warning');
  });
});

