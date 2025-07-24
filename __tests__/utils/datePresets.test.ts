import { getDateRangeFromPreset, DatePreset } from "@/utils/datePresets"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns"

describe("getDateRangeFromPreset", () => {
  // Fixed reference date for consistent testing: Wednesday, March 15, 2023, 14:30:00
  const referenceDate = new Date(2023, 2, 15, 14, 30, 0, 0)

  describe("today preset", () => {
    it("should return start and end of the same day", () => {
      const result = getDateRangeFromPreset("today", referenceDate)

      expect(result.start).toEqual(startOfDay(referenceDate))
      expect(result.end).toEqual(endOfDay(referenceDate))

      // Verify it's the same date
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-03-15")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-03-15")

      // Verify time boundaries
      expect(result.start.getHours()).toBe(0)
      expect(result.start.getMinutes()).toBe(0)
      expect(result.start.getSeconds()).toBe(0)
      expect(result.start.getMilliseconds()).toBe(0)

      expect(result.end.getHours()).toBe(23)
      expect(result.end.getMinutes()).toBe(59)
      expect(result.end.getSeconds()).toBe(59)
      expect(result.end.getMilliseconds()).toBe(999)
    })
  })

  describe("week preset", () => {
    it("should return current week boundaries starting on Sunday (default)", () => {
      const result = getDateRangeFromPreset("week", referenceDate)

      expect(result.start).toEqual(startOfWeek(referenceDate, { weekStartsOn: 0 }))
      expect(result.end).toEqual(endOfWeek(referenceDate, { weekStartsOn: 0 }))

      // March 15, 2023 is a Wednesday
      // Week should start on Sunday March 12, 2023 and end on Saturday March 18, 2023
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-03-12")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-03-18")

      // Verify start is Sunday (day 0)
      expect(result.start.getDay()).toBe(0)
      // Verify end is Saturday (day 6)
      expect(result.end.getDay()).toBe(6)
    })

    it("should return current week boundaries starting on Monday", () => {
      const result = getDateRangeFromPreset("week", referenceDate, 1)

      expect(result.start).toEqual(startOfWeek(referenceDate, { weekStartsOn: 1 }))
      expect(result.end).toEqual(endOfWeek(referenceDate, { weekStartsOn: 1 }))

      // March 15, 2023 is a Wednesday
      // Week should start on Monday March 13, 2023 and end on Sunday March 19, 2023
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-03-13")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-03-19")

      // Verify start is Monday (day 1)
      expect(result.start.getDay()).toBe(1)
      // Verify end is Sunday (day 0)
      expect(result.end.getDay()).toBe(0)
    })
  })

  describe("month preset", () => {
    it("should return current month boundaries", () => {
      const result = getDateRangeFromPreset("month", referenceDate)

      expect(result.start).toEqual(startOfMonth(referenceDate))
      expect(result.end).toEqual(endOfMonth(referenceDate))

      // March 2023 should start on March 1 and end on March 31
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-03-01")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-03-31")

      // Verify start is first day of month
      expect(result.start.getDate()).toBe(1)
      // Verify end is last day of month
      expect(result.end.getDate()).toBe(31)
    })
  })

  describe("quarter preset", () => {
    it("should return current quarter boundaries", () => {
      const result = getDateRangeFromPreset("quarter", referenceDate)

      expect(result.start).toEqual(startOfQuarter(referenceDate))
      expect(result.end).toEqual(endOfQuarter(referenceDate))

      // March 2023 is in Q1, so should start on January 1 and end on March 31
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-01-01")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-03-31")

      // Verify start is January 1st
      expect(result.start.getMonth()).toBe(0) // January is 0
      expect(result.start.getDate()).toBe(1)

      // Verify end is March 31st
      expect(result.end.getMonth()).toBe(2) // March is 2
      expect(result.end.getDate()).toBe(31)
    })
  })

  describe("year preset", () => {
    it("should return current year boundaries", () => {
      const result = getDateRangeFromPreset("year", referenceDate)

      expect(result.start).toEqual(startOfYear(referenceDate))
      expect(result.end).toEqual(endOfYear(referenceDate))

      // 2023 should start on January 1 and end on December 31
      expect(format(result.start, "yyyy-MM-dd")).toBe("2023-01-01")
      expect(format(result.end, "yyyy-MM-dd")).toBe("2023-12-31")

      // Verify start is January 1st
      expect(result.start.getMonth()).toBe(0)
      expect(result.start.getDate()).toBe(1)

      // Verify end is December 31st
      expect(result.end.getMonth()).toBe(11) // December is 11
      expect(result.end.getDate()).toBe(31)
    })
  })

  describe("edge cases", () => {
    it("should throw error for unsupported preset", () => {
      expect(() => {
        getDateRangeFromPreset("invalid" as DatePreset, referenceDate)
      }).toThrow("Unsupported date preset: invalid")
    })

    it("should use current date when no reference date provided", () => {
      const result = getDateRangeFromPreset("today")
      const now = new Date()

      // Should be same day as current date
      expect(format(result.start, "yyyy-MM-dd")).toBe(format(now, "yyyy-MM-dd"))
      expect(format(result.end, "yyyy-MM-dd")).toBe(format(now, "yyyy-MM-dd"))
    })

    it("should create new Date instances and not mutate input", () => {
      const originalDate = new Date(referenceDate)
      const result = getDateRangeFromPreset("today", referenceDate)

      // Verify original date is unchanged
      expect(referenceDate).toEqual(originalDate)

      // Verify returned dates are different instances
      expect(result.start).not.toBe(referenceDate)
      expect(result.end).not.toBe(referenceDate)
      expect(result.start).not.toBe(result.end)
    })
  })

  describe("week boundaries verification", () => {
    it("should produce correct Sunday-Saturday boundaries for various dates", () => {
      // Test various days of the week
      const testCases = [
        {
          date: new Date(2023, 2, 12),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Sunday",
        },
        {
          date: new Date(2023, 2, 13),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Monday",
        },
        {
          date: new Date(2023, 2, 14),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Tuesday",
        },
        {
          date: new Date(2023, 2, 15),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Wednesday",
        },
        {
          date: new Date(2023, 2, 16),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Thursday",
        },
        {
          date: new Date(2023, 2, 17),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Friday",
        },
        {
          date: new Date(2023, 2, 18),
          expectedStart: "2023-03-12",
          expectedEnd: "2023-03-18",
          day: "Saturday",
        },
      ]

      testCases.forEach(({ date, expectedStart, expectedEnd, day }) => {
        const result = getDateRangeFromPreset("week", date, 0)
        expect(format(result.start, "yyyy-MM-dd")).toBe(expectedStart)
        expect(format(result.end, "yyyy-MM-dd")).toBe(expectedEnd)
      })
    })

    it("should produce correct Monday-Sunday boundaries for various dates", () => {
      const testCases = [
        {
          date: new Date(2023, 2, 12),
          expectedStart: "2023-03-06",
          expectedEnd: "2023-03-12",
          day: "Sunday",
        },
        {
          date: new Date(2023, 2, 13),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Monday",
        },
        {
          date: new Date(2023, 2, 14),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Tuesday",
        },
        {
          date: new Date(2023, 2, 15),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Wednesday",
        },
        {
          date: new Date(2023, 2, 16),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Thursday",
        },
        {
          date: new Date(2023, 2, 17),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Friday",
        },
        {
          date: new Date(2023, 2, 18),
          expectedStart: "2023-03-13",
          expectedEnd: "2023-03-19",
          day: "Saturday",
        },
      ]

      testCases.forEach(({ date, expectedStart, expectedEnd, day }) => {
        const result = getDateRangeFromPreset("week", date, 1)
        expect(format(result.start, "yyyy-MM-dd")).toBe(expectedStart)
        expect(format(result.end, "yyyy-MM-dd")).toBe(expectedEnd)
      })
    })
  })
})
