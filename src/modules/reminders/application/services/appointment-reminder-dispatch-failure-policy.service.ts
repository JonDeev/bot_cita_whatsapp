import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export interface AppointmentReminderDispatchFailureDecision {
  isRetryable: boolean;
  nextAttemptAtIso: string | null;
}

@Injectable()
export class AppointmentReminderDispatchFailurePolicyService {
  resolve(input: {
    attempts: number;
    runAtIso: string;
    error: unknown;
  }): AppointmentReminderDispatchFailureDecision {
    if (!this.isRetryable(input.error)) {
      return {
        isRetryable: false,
        nextAttemptAtIso: null,
      };
    }

    return {
      isRetryable: true,
      nextAttemptAtIso: this.resolveRetryWindow(input.attempts, input.runAtIso),
    };
  }

  private isRetryable(error: unknown): boolean {
    if (
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      return false;
    }

    if (error instanceof HttpException) {
      if (error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        return true;
      }

      return error.getStatus() >= 500;
    }

    return true;
  }

  private resolveRetryWindow(
    attempts: number,
    runAtIso: string,
  ): string | null {
    const runAt = new Date(runAtIso).getTime();
    if (attempts === 1) {
      return new Date(runAt + 5 * 60 * 1000).toISOString();
    }

    if (attempts === 2) {
      return new Date(runAt + 15 * 60 * 1000).toISOString();
    }

    return null;
  }
}
