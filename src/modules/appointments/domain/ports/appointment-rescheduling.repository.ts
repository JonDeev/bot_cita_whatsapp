export interface RescheduleAssignedFutureAppointmentByPatientCommand {
  patientUserId: string;
  patientPhone: string;
  originalSlotRef: string;
  preferredNewSlotRef: string;
  specialtyCups: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  currentDateIso: string;
  currentTimeHHmm: string;
  requestDateIso: string;
  canceledDateIso: string;
  requiredSiteId: number;
  doctorEmployeeCode?: string;
}

export type RescheduleAssignedFutureAppointmentByPatientResult =
  | {
      status: 'RESCHEDULED';
      assignedSlotRef: string;
      usedFallbackSlot: boolean;
    }
  | {
      status: 'TIME_NO_LONGER_AVAILABLE';
    }
  | {
      status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE';
    };

export interface AppointmentReschedulingRepository {
  rescheduleAssignedFutureAppointmentByPatient(
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<RescheduleAssignedFutureAppointmentByPatientResult>;
}
