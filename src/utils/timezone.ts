import { addDays, isAfter, startOfDay } from "date-fns";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import type { Availability } from "../entities/Availability";

export const DEFAULT_TIMEZONE = "UTC";

type AvailabilityLike = Pick<
  Availability,
  "dayOfWeek" | "startTime" | "endTime" | "timezone"
>;

export function isValidTimeZone(timeZone?: string | null): boolean {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone?: string | null): string {
  return isValidTimeZone(timeZone) ? timeZone! : DEFAULT_TIMEZONE;
}

export function getDateKeyInTimeZone(date: Date, timeZone?: string | null): string {
  return formatInTimeZone(date, normalizeTimeZone(timeZone), "yyyy-MM-dd");
}

export function getLocalTimeInTimeZone(date: Date, timeZone?: string | null): string {
  return formatInTimeZone(date, normalizeTimeZone(timeZone), "HH:mm:ss");
}

export function getDayOfWeekFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

export function buildUtcDateFromLocalDateTime(
  dateKey: string,
  time: string,
  timeZone?: string | null,
): Date {
  return zonedTimeToUtc(`${dateKey}T${time}`, normalizeTimeZone(timeZone));
}

export function formatDateTimeInTimeZone(
  date: Date,
  timeZone?: string | null,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatConflictWindow(
  start: Date,
  end: Date,
  timeZone?: string | null,
  locale = "en-US",
): string {
  const normalizedTimeZone = normalizeTimeZone(timeZone);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone: normalizedTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);

  const startLabel = new Intl.DateTimeFormat(locale, {
    timeZone: normalizedTimeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);

  const endLabel = new Intl.DateTimeFormat(locale, {
    timeZone: normalizedTimeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(end);

  return `${dateLabel} ${startLabel}-${endLabel}`;
}

export function getPrimaryTimeZone(availabilities: Array<Pick<Availability, "timezone">>): string {
  return normalizeTimeZone(
    availabilities.find((availability) => availability.timezone)?.timezone,
  );
}

export function getNextOccurrences(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  count: number,
  timeZone?: string | null,
): Array<{ start: Date; end: Date }> {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const now = new Date();
  const cursorEnd = startOfDay(addDays(now, count * 14));
  const windows: Array<{ start: Date; end: Date }> = [];
  const seenDates = new Set<string>();

  for (
    let cursor = startOfDay(addDays(now, -1));
    cursor <= cursorEnd && windows.length < count;
    cursor = addDays(cursor, 1)
  ) {
    const localDate = getDateKeyInTimeZone(cursor, normalizedTimeZone);

    if (seenDates.has(localDate)) {
      continue;
    }
    seenDates.add(localDate);

    if (getDayOfWeekFromDateKey(localDate) !== dayOfWeek) {
      continue;
    }

    const start = buildUtcDateFromLocalDateTime(localDate, startTime, normalizedTimeZone);
    const end = buildUtcDateFromLocalDateTime(localDate, endTime, normalizedTimeZone);

    if (isAfter(end, now)) {
      windows.push({ start, end });
    }
  }

  return windows;
}

export function findAvailabilityForDateTimeRange(
  availabilities: AvailabilityLike[],
  start: Date,
  end: Date,
): AvailabilityLike | null {
  for (const availability of availabilities) {
    const normalizedTimeZone = normalizeTimeZone(availability.timezone);
    const localDate = getDateKeyInTimeZone(start, normalizedTimeZone);

    if (getDayOfWeekFromDateKey(localDate) !== availability.dayOfWeek) {
      continue;
    }

    const localStartTime = getLocalTimeInTimeZone(start, normalizedTimeZone);
    const localEndTime = getLocalTimeInTimeZone(end, normalizedTimeZone);

    if (
      localStartTime >= availability.startTime &&
      localEndTime <= availability.endTime
    ) {
      return availability;
    }
  }

  return null;
}

export function getAvailabilityWindowsInRange(
  availability: AvailabilityLike,
  rangeStart: Date,
  rangeEnd: Date,
): Array<{ start: Date; end: Date; timeZone: string }> {
  const normalizedTimeZone = normalizeTimeZone(availability.timezone);
  const windows: Array<{ start: Date; end: Date; timeZone: string }> = [];
  const seenDates = new Set<string>();

  for (
    let cursor = startOfDay(addDays(rangeStart, -1));
    cursor <= startOfDay(addDays(rangeEnd, 1));
    cursor = addDays(cursor, 1)
  ) {
    const localDate = getDateKeyInTimeZone(cursor, normalizedTimeZone);

    if (seenDates.has(localDate)) {
      continue;
    }
    seenDates.add(localDate);

    if (getDayOfWeekFromDateKey(localDate) !== availability.dayOfWeek) {
      continue;
    }

    const start = buildUtcDateFromLocalDateTime(
      localDate,
      availability.startTime,
      normalizedTimeZone,
    );
    const end = buildUtcDateFromLocalDateTime(
      localDate,
      availability.endTime,
      normalizedTimeZone,
    );

    if (end <= rangeStart || start >= rangeEnd) {
      continue;
    }

    windows.push({ start, end, timeZone: normalizedTimeZone });
  }

  return windows;
}
