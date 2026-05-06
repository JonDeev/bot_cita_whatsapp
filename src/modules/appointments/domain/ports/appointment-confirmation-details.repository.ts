export interface PatientAppointmentConfirmationDetails {
  userId: number;
  firstName: string;
  secondName: string | null;
  firstLastName: string;
  secondLastName: string | null;
  phone: string | null;
}

export interface AssignedAppointmentConfirmationDetails {
  slotRef: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  professionalName: string | null;
  siteName: string | null;
  siteAddress: string | null;
}

export interface AppointmentConfirmationDetailsRepository {
  findPatientById(patientId: number): Promise<PatientAppointmentConfirmationDetails | null>;

  findAssignedAppointmentBySlotRef(
    slotRef: string,
  ): Promise<AssignedAppointmentConfirmationDetails | null>;
}
