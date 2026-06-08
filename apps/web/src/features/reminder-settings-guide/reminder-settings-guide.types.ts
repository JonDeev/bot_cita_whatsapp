export interface ReminderSettingsGuideReferenceRow {
  field: string;
  meaning: string;
}

export interface ReminderSettingsGuideCallout {
  title: string;
  body: string;
  tone?: 'neutral' | 'warning' | 'success';
}

export interface ReminderSettingsGuideSectionContent {
  id: string;
  title: string;
  summary: string;
  paragraphs: string[];
  bullets?: string[];
  referenceRows?: ReminderSettingsGuideReferenceRow[];
  callout?: ReminderSettingsGuideCallout;
}

