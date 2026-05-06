import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AssignAppointmentSlotAfterTimeSelectionUseCase } from './application/use-cases/assign-appointment-slot-after-time-selection.use-case';
import { FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase } from './application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from './application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from './application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AppointmentAvailabilityCutoffService } from './application/services/appointment-availability-cutoff.service';
import { AppointmentDatePresenterService } from './application/services/appointment-date-presenter.service';
import { AppointmentTimePresenterService } from './application/services/appointment-time-presenter.service';
import {
  APPOINTMENT_ASSIGNMENT_REPOSITORY,
  APPOINTMENT_AVAILABILITY_REPOSITORY,
  APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
  APPOINTMENT_PENDING_CHECK_REPOSITORY,
} from './domain/appointments.tokens';
import { PrismaLegacyAppointmentAssignmentRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-assignment.repository';
import { PrismaLegacyAppointmentAvailabilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-availability.repository';
import { PrismaLegacyAppointmentConfirmationDetailsRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-confirmation-details.repository';
import { PrismaLegacyPendingAppointmentCheckRepository } from './infrastructure/persistence/mysql/prisma-legacy-pending-appointment-check.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    AppointmentAvailabilityCutoffService,
    AppointmentDatePresenterService,
    AppointmentTimePresenterService,
    AssignAppointmentSlotAfterTimeSelectionUseCase,
    FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
    ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    {
      provide: APPOINTMENT_AVAILABILITY_REPOSITORY,
      useClass: PrismaLegacyAppointmentAvailabilityRepository,
    },
    {
      provide: APPOINTMENT_ASSIGNMENT_REPOSITORY,
      useClass: PrismaLegacyAppointmentAssignmentRepository,
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
    FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
    ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
  ],
})
export class AppointmentsModule {}
