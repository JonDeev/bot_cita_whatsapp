import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import { buildAppointmentDoctorOptionId } from './appointment-doctor-option-id';
import { AppointmentDoctorListPresenterService } from './appointment-doctor-list-presenter.service';

interface AppointmentDoctorListItem {
  employeeCode: string;
  displayName: string;
}

@Injectable()
export class AppointmentDoctorListFactory {
  constructor(
    private readonly appointmentDoctorListPresenter: AppointmentDoctorListPresenterService,
  ) {}

  build(doctors: AppointmentDoctorListItem[]): ConversationOutboundInteractiveListMessage {
    return {
      type: 'interactive_list',
      body: 'Selecciona el medico con quien deseas agendar.',
      buttonText: 'Ver medicos',
      sections: [
        {
          title: 'Medicos disponibles',
          rows: doctors.map((doctor) => {
            const presentedRow = this.appointmentDoctorListPresenter.present(doctor.displayName);
            return {
              id: buildAppointmentDoctorOptionId(doctor.employeeCode),
              title: presentedRow.title,
              description: presentedRow.description,
            };
          }),
        },
      ],
    };
  }
}
