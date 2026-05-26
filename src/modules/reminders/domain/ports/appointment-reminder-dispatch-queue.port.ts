export interface ScheduleAppointmentReminderDispatchJobCommand {
  dispatchId: number;
  scheduledForIso: string;
}

export interface AppointmentReminderDispatchQueuePort {
  scheduleDispatchJob(
    command: ScheduleAppointmentReminderDispatchJobCommand,
  ): Promise<void>;
}
