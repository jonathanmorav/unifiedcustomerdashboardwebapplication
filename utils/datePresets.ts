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
} from "date-fns"

export type DatePreset = "today" | "week" | "month" | "quarter" | "year"

export interface DateRangeResult {
  start: Date
  end: Date
}

/**
 * Converts a date preset into start and end Date objects using immutable date-fns helpers.
 * Always creates new Date instances and never mutates existing ones.
 *
 * @param preset - The date preset to convert
 * @param referenceDate - The reference date to calculate from (defaults to current date)
 * @param weekStartsOn - Day of the week that starts the week (0 = Sunday, 1 = Monday)
 * @returns Object with start and end Date objects
 */
export function getDateRangeFromPreset(
  preset: DatePreset,
  referenceDate: Date = new Date(),
  weekStartsOn: 0 | 1 = 0
): DateRangeResult {
  // Create a new Date instance to avoid any potential mutation
  const now = new Date(referenceDate)

  switch (preset) {
    case "today":
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      }

    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn }),
        end: endOfWeek(now, { weekStartsOn }),
      }

    case "month":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      }

    case "quarter":
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
      }

    case "year":
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      }

    default:
      // This should never happen with proper TypeScript typing
      throw new Error(`Unsupported date preset: ${preset}`)
  }
}
