export const APPOINTMENT_REMINDER_BUSINESS_TIMEZONE = 'America/Bogota';

interface AppointmentDateParts {
  year: number;
  month: number;
  day: number;
}

interface AppointmentTimeParts {
  hour: number;
  minute: number;
}

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function resolveAppointmentStartsAtFromIso(input: {
  appointmentDateIso: string;
  appointmentTimeHhmm: string;
  timeZone?: string;
}): string {
  const date = new Date(input.appointmentDateIso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid appointment date value: ${input.appointmentDateIso}`);
  }

  return resolveAppointmentStartsAtFromDate({
    appointmentDate: date,
    appointmentTimeHhmm: input.appointmentTimeHhmm,
    timeZone: input.timeZone,
  }).toISOString();
}

export function resolveAppointmentStartsAtFromDate(input: {
  appointmentDate: Date;
  appointmentTimeHhmm: string;
  timeZone?: string;
}): Date {
  const dateParts = extractUtcDateParts(input.appointmentDate);
  const timeParts = parseAppointmentTimeHhmm(input.appointmentTimeHhmm);
  const timeZone =
    input.timeZone ?? APPOINTMENT_REMINDER_BUSINESS_TIMEZONE;

  return resolveBusinessLocalDateTimeToUtc({
    ...dateParts,
    ...timeParts,
    timeZone,
  });
}

export function parseAppointmentTimeHhmm(
  appointmentTimeHhmm: string,
): AppointmentTimeParts {
  const match = /^(?<hour>\d{2}):(?<minute>\d{2})$/.exec(appointmentTimeHhmm);

  if (!match?.groups) {
    throw new Error(`Invalid appointment time format: ${appointmentTimeHhmm}`);
  }

  const hour = Number.parseInt(match.groups.hour, 10);
  const minute = Number.parseInt(match.groups.minute, 10);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Invalid appointment time value: ${appointmentTimeHhmm}`);
  }

  return { hour, minute };
}

function extractUtcDateParts(date: Date): AppointmentDateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function resolveBusinessLocalDateTimeToUtc(input: AppointmentDateParts &
  AppointmentTimeParts & {
    timeZone: string;
  }): Date {
  const naiveUtcMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0,
  );

  let resolvedUtcMs = naiveUtcMs;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offsetMs = getTimeZoneOffsetMs(
      new Date(resolvedUtcMs),
      input.timeZone,
    );
    resolvedUtcMs = naiveUtcMs - offsetMs;
  }

  return new Date(resolvedUtcMs);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = getOffsetFormatter(timeZone);
  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (!timeZoneName) {
    throw new Error(`Unable to resolve timezone offset for ${timeZone}.`);
  }

  return parseOffsetMs(timeZoneName);
}

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  offsetFormatterCache.set(timeZone, formatter);
  return formatter;
}

function parseOffsetMs(timeZoneName: string): number {
  if (timeZoneName === 'GMT' || timeZoneName === 'UTC') {
    return 0;
  }

  const match =
    /^(?:GMT|UTC)(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/.exec(
      timeZoneName,
    );

  if (!match?.groups) {
    throw new Error(`Unsupported timezone offset format: ${timeZoneName}`);
  }

  const sign = match.groups.sign === '-' ? -1 : 1;
  const hours = Number.parseInt(match.groups.hours, 10);
  const minutes = Number.parseInt(match.groups.minutes ?? '0', 10);

  return sign * (hours * 60 + minutes) * 60 * 1000;
}
