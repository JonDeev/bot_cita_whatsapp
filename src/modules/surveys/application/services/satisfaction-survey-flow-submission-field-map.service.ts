import { Injectable } from '@nestjs/common';

export interface SatisfactionSurveyFlowFieldMap {
  decision: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5Comment: string;
}

@Injectable()
export class SatisfactionSurveyFlowSubmissionFieldMapService {
  getFieldMap(): SatisfactionSurveyFlowFieldMap {
    return {
      decision: this.readKeyEnv('SURVEY_FLOW_FIELD_DECISION', 'survey_decision'),
      q1: this.readKeyEnv('SURVEY_FLOW_FIELD_Q1', 'q1'),
      q2: this.readKeyEnv('SURVEY_FLOW_FIELD_Q2', 'q2'),
      q3: this.readKeyEnv('SURVEY_FLOW_FIELD_Q3', 'q3'),
      q4: this.readKeyEnv('SURVEY_FLOW_FIELD_Q4', 'q4'),
      q5Comment: this.readKeyEnv('SURVEY_FLOW_FIELD_Q5_COMMENT', 'q5_comment'),
    };
  }

  private readKeyEnv(key: string, fallback: string): string {
    const value = (process.env[key] ?? '').trim();
    return value || fallback;
  }
}
