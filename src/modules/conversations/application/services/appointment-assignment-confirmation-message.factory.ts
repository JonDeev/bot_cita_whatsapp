import { Injectable } from '@nestjs/common';
import type { AssignedAppointmentDetails } from '../../../appointments/application/use-cases/assign-appointment-slot-after-time-selection.use-case';

@Injectable()
export class AppointmentAssignmentConfirmationMessageFactory {
  build(appointment: AssignedAppointmentDetails): string {
    return (
      `Señor(a) ${appointment.patientFullName}, su cita se asignó satisfactoriamente.\n\n` +
      `🩺Especialidad: ${appointment.specialtyName}\n` +
      '👩🏼‍💻Modalida: PRESENCIAL\n' +
      `📅Fecha de la cita: ${appointment.appointmentDateIso}\n` +
      `🕜Hora: ${appointment.appointmentDisplayTime}\n` +
      `👩🏼‍⚕️Profesional: ${appointment.professionalName}\n` +
      `🏙️Sede: ${appointment.siteName}.\n` +
      `🏙️Direccion: ${appointment.siteAddress}.\n\n` +
      'Favor estar 🕘 15 minutos antes de la hora asignada'
    );
  }
}
