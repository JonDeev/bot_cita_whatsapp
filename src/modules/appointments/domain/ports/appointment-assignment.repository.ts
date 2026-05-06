export interface AssignAvailableSlotCommand {
  slotRef: string;
  patientUserId: string;
  patientPhone: string;
  requestDateIso: string;
  requiredSiteId: number;
}

export interface FindFallbackAvailableSlotFilters {
  specialtyCups: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  requiredSiteId: number;
  excludeSlotRef?: string;
}

export interface AppointmentSlotCandidate {
  slotRef: string;
}

export interface AppointmentAssignmentRepository {
  assignSlotIfAvailable(command: AssignAvailableSlotCommand): Promise<boolean>;

  findFallbackAvailableSlot(
    filters: FindFallbackAvailableSlotFilters,
  ): Promise<AppointmentSlotCandidate | null>;
}
