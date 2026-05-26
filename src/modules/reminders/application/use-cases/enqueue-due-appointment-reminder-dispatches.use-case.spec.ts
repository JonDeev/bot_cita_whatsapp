import { EnqueueDueAppointmentReminderDispatchesUseCase } from './enqueue-due-appointment-reminder-dispatches.use-case';

describe('EnqueueDueAppointmentReminderDispatchesUseCase', () => {
  it('enqueues due dispatches when queue mode is enabled', async () => {
    const dispatchRepository = {
      findDueDispatchIds: jest.fn().mockResolvedValue([11, 12]),
    };
    const dispatchQueue = {
      scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      isQueueEnabled: jest.fn().mockReturnValue(true),
      getDispatchBatchSize: jest.fn().mockReturnValue(50),
    };

    const useCase = new EnqueueDueAppointmentReminderDispatchesUseCase(
      dispatchRepository as any,
      dispatchQueue,
      configService as any,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-26T15:00:00.000Z',
    });

    expect(dispatchRepository.findDueDispatchIds).toHaveBeenCalledWith({
      runAtIso: '2026-05-26T15:00:00.000Z',
      limit: 50,
    });
    expect(dispatchQueue.scheduleDispatchJob).toHaveBeenCalledTimes(2);
    expect(dispatchQueue.scheduleDispatchJob).toHaveBeenNthCalledWith(1, {
      dispatchId: 11,
      scheduledForIso: '2026-05-26T15:00:00.000Z',
    });
    expect(dispatchQueue.scheduleDispatchJob).toHaveBeenNthCalledWith(2, {
      dispatchId: 12,
      scheduledForIso: '2026-05-26T15:00:00.000Z',
    });
    expect(result.enqueued).toBe(2);
  });

  it('does nothing when queue mode is disabled', async () => {
    const dispatchRepository = {
      findDueDispatchIds: jest.fn(),
    };
    const dispatchQueue = {
      scheduleDispatchJob: jest.fn(),
    };
    const configService = {
      isQueueEnabled: jest.fn().mockReturnValue(false),
      getDispatchBatchSize: jest.fn(),
    };

    const useCase = new EnqueueDueAppointmentReminderDispatchesUseCase(
      dispatchRepository as any,
      dispatchQueue,
      configService as any,
    );

    const result = await useCase.execute();

    expect(dispatchRepository.findDueDispatchIds).not.toHaveBeenCalled();
    expect(dispatchQueue.scheduleDispatchJob).not.toHaveBeenCalled();
    expect(result.enqueued).toBe(0);
  });
});
