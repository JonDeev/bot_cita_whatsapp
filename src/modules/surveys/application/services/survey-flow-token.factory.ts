import { Injectable } from '@nestjs/common';

@Injectable()
export class SurveyFlowTokenFactory {
  create(input: { dispatchId: number; surveyDateIso: string }): string {
    return `survey_dispatch:${input.dispatchId}:${input.surveyDateIso}`;
  }
}
