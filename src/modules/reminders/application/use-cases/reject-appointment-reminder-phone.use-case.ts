import { Injectable } from '@nestjs/common';
import {
  HandleAppointmentReminderVerificationReplyInput,
  HandleAppointmentReminderVerificationReplyResult,
  HandleAppointmentReminderVerificationReplyUseCase,
} from './handle-appointment-reminder-verification-reply.use-case';

@Injectable()
export class RejectAppointmentReminderPhoneUseCase {
  constructor(
    private readonly handler: HandleAppointmentReminderVerificationReplyUseCase,
  ) {}

  async execute(
    input: HandleAppointmentReminderVerificationReplyInput,
  ): Promise<HandleAppointmentReminderVerificationReplyResult> {
    return this.handler.execute(input);
  }
}
