import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AssignAppointmentSlotAfterTimeSelectionUseCase } from './application/use-cases/assign-appointment-slot-after-time-selection.use-case';
import { CancelAssignedAppointmentByPatientUseCase } from './application/use-cases/cancel-assigned-appointment-by-patient.use-case';
import { FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase } from './application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case';
import { ListFutureAssignedAppointmentsByPatientUseCase } from './application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { ResolveAvailableAppointmentDoctorsBySpecialtyUseCase } from './application/use-cases/resolve-available-appointment-doctors-by-specialty.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from './application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from './application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { RescheduleAssignedAppointmentByPatientUseCase } from './application/use-cases/reschedule-assigned-appointment-by-patient.use-case';
import { AppointmentAvailabilityCutoffService } from './application/services/appointment-availability-cutoff.service';
import { AppointmentDatePresenterService } from './application/services/appointment-date-presenter.service';
import { AppointmentTimePresenterService } from './application/services/appointment-time-presenter.service';
import {
  APPOINTMENT_ASSIGNMENT_REPOSITORY,
  APPOINTMENT_ASSIGNED_LIST_REPOSITORY,
  APPOINTMENT_AVAILABILITY_REPOSITORY,
  APPOINTMENT_CANCELLATION_REPOSITORY,
  APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
  APPOINTMENT_PENDING_CHECK_REPOSITORY,
  APPOINTMENT_RESCHEDULING_REPOSITORY,
} from './domain/appointments.tokens';
import { PrismaLegacyAppointmentAssignmentRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-assignment.repository';
import { PrismaLegacyAppointmentAvailabilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-availability.repository';
import { PrismaLegacyAppointmentCancellationRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-cancellation.repository';
import { PrismaLegacyAppointmentConfirmationDetailsRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-confirmation-details.repository';
import { PrismaLegacyAppointmentReschedulingRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-rescheduling.repository';
import { PrismaLegacyPatientAssignedAppointmentRepository } from './infrastructure/persistence/mysql/prisma-legacy-patient-assigned-appointment.repository';
import { PrismaLegacyPendingAppointmentCheckRepository } from './infrastructure/persistence/mysql/prisma-legacy-pending-appointment-check.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    AppointmentAvailabilityCutoffService,
    AppointmentDatePresenterService,
    AppointmentTimePresenterService,
    AssignAppointmentSlotAfterTimeSelectionUseCase,
    CancelAssignedAppointmentByPatientUseCase,
    FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
    ListFutureAssignedAppointmentsByPatientUseCase,
    ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
    ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    RescheduleAssignedAppointmentByPatientUseCase,
    {
      provide: APPOINTMENT_AVAILABILITY_REPOSITORY,
      useClass: PrismaLegacyAppointmentAvailabilityRepository,
    },
    {
      provide: APPOINTMENT_ASSIGNMENT_REPOSITORY,
      useClass: PrismaLegacyAppointmentAssignmentRepository,
    },
    {
      provide: APPOINTMENT_ASSIGNED_LIST_REPOSITORY,
      useClass: PrismaLegacyPatientAssignedAppointmentRepository,
    },
    {
      provide: APPOINTMENT_CANCELLATION_REPOSITORY,
      useClass: PrismaLegacyAppointmentCancellationRepository,
    },
    {
      provide: APPOINTMENT_RESCHEDULING_REPOSITORY,
      useClass: PrismaLegacyAppointmentReschedulingRepository,
    },
    {
      provide: APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
      useClass: PrismaLegacyAppointmentConfirmationDetailsRepository,
    },
    {
      provide: APPOINTMENT_PENDING_CHECK_REPOSITORY,
      useClass: PrismaLegacyPendingAppointmentCheckRepository,
    },
  ],
  exports: [
    AssignAppointmentSlotAfterTimeSelectionUseCase,
    CancelAssignedAppointmentByPatientUseCase,
    FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
    ListFutureAssignedAppointmentsByPatientUseCase,
    ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
    ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    RescheduleAssignedAppointmentByPatientUseCase,
  ],
})
export class AppointmentsModule {}
