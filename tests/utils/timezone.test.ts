import { describe, it, expect } from "vitest";
import {
  normalizeTimeZone,
  isValidTimeZone,
  findAvailabilityForDateTimeRange,
} from "../../src/utils/timezone";

describe("timezone utils", () => {
  describe("isValidTimeZone", () => {
    it("accepts IANA zones", () => {
      expect(isValidTimeZone("UTC")).toBe(true);
      expect(isValidTimeZone("Europe/London")).toBe(true);
    });

    it("rejects garbage and nullish input", () => {
      expect(isValidTimeZone("Not/A/Zone")).toBe(false);
      expect(isValidTimeZone(undefined)).toBe(false);
      expect(isValidTimeZone(null)).toBe(false);
    });
  });

  describe("normalizeTimeZone", () => {
    it("returns the input when valid", () => {
      expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
    });

    it("falls back to UTC when invalid or unset", () => {
      expect(normalizeTimeZone("Not/A/Zone")).toBe("UTC");
      expect(normalizeTimeZone("")).toBe("UTC");
      expect(normalizeTimeZone(null)).toBe("UTC");
      expect(normalizeTimeZone(undefined)).toBe("UTC");
    });
  });

  describe("findAvailabilityForDateTimeRange", () => {
    // Monday 09:00-12:00 UTC.
    const monday9to12 = {
      dayOfWeek: 1,
      startTime: "09:00:00",
      endTime: "12:00:00",
      timezone: "UTC",
    };

    it("returns the matching availability when the slot is fully inside the window", () => {
      const start = new Date("2024-01-08T10:00:00Z"); // Monday
      const end = new Date("2024-01-08T11:00:00Z");
      expect(
        findAvailabilityForDateTimeRange([monday9to12], start, end)
      ).toEqual(monday9to12);
    });

    it("returns null when the day of week does not match", () => {
      const start = new Date("2024-01-09T10:00:00Z"); // Tuesday
      const end = new Date("2024-01-09T11:00:00Z");
      expect(
        findAvailabilityForDateTimeRange([monday9to12], start, end)
      ).toBeNull();
    });

    it("returns null when the slot extends past the end of the window", () => {
      const start = new Date("2024-01-08T11:30:00Z");
      const end = new Date("2024-01-08T12:30:00Z");
      expect(
        findAvailabilityForDateTimeRange([monday9to12], start, end)
      ).toBeNull();
    });

    it("returns null when the slot starts before the window opens", () => {
      const start = new Date("2024-01-08T08:30:00Z");
      const end = new Date("2024-01-08T09:30:00Z");
      expect(
        findAvailabilityForDateTimeRange([monday9to12], start, end)
      ).toBeNull();
    });

    it("picks the first matching availability from a list", () => {
      const tuesday = {
        dayOfWeek: 2,
        startTime: "09:00:00",
        endTime: "12:00:00",
        timezone: "UTC",
      };
      const start = new Date("2024-01-09T10:00:00Z"); // Tuesday
      const end = new Date("2024-01-09T11:00:00Z");
      expect(
        findAvailabilityForDateTimeRange([monday9to12, tuesday], start, end)
      ).toEqual(tuesday);
    });
  });
});
