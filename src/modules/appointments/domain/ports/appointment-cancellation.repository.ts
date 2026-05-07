export interface CancelAssignedFutureAppointmentCommand {
  slotRef: string;
  patientUserId: string;
  currentDateIso: string;
  currentTimeHHmm: string;
  canceledDateIso: string;
}

export interface AppointmentCancellationRepository {
  cancelAssignedFutureAppointmentByPatient(
    command: CancelAssignedFutureAppointmentCommand,
  ): Promise<boolean>;
}
