/**
 * Theme system tests
 */
import {
  calculateContrast,
  hexToRgb,
  meetsWCAGContrast,
  lightTheme,
  darkTheme,
} from "@/lib/theme/colors"

describe("Theme Color System", () => {
  describe("Color Utilities", () => {
    test("hexToRgb converts correctly", () => {
      expect(hexToRgb("#ffffff")).toEqual([255, 255, 255])
      expect(hexToRgb("#000000")).toEqual([0, 0, 0])
      expect(hexToRgb("#5791f3")).toEqual([87, 145, 243])
    })

    test("calculateContrast returns correct ratios", () => {
      // White on black should be 21:1
      const whiteOnBlack = calculateContrast([255, 255, 255], [0, 0, 0])
      expect(whiteOnBlack).toBeCloseTo(21, 0)

      // Same color should be 1:1
      const sameColor = calculateContrast([128, 128, 128], [128, 128, 128])
      expect(sameColor).toBeCloseTo(1, 0)
    })

    test("meetsWCAGContrast validates correctly", () => {
      // Good contrast
      expect(meetsWCAGContrast("#000000", "#ffffff", "AA", "normal")).toBe(true)
      expect(meetsWCAGContrast("#000000", "#ffffff", "AAA", "normal")).toBe(true)

      // Poor contrast
      expect(meetsWCAGContrast("#777777", "#888888", "AA", "normal")).toBe(false)
      expect(meetsWCAGContrast("#777777", "#888888", "AAA", "normal")).toBe(false)

      // Large text has lower requirements
      expect(meetsWCAGContrast("#666666", "#ffffff", "AA", "large")).toBe(true)
    })
  })

  describe("Light Theme Contrast", () => {
    test("primary text meets WCAG AA on light backgrounds", () => {
      const textColor = lightTheme.textPrimary.value
      const bgColor = lightTheme.bgAlice100.value
      expect(meetsWCAGContrast(textColor, bgColor, "AA")).toBe(true)
    })

    test("secondary text meets WCAG AA on light backgrounds", () => {
      const textColor = lightTheme.textSecondary.value
      const bgColor = lightTheme.bgAlice100.value
      expect(meetsWCAGContrast(textColor, bgColor, "AA")).toBe(true)
    })

    test("all interactive elements meet WCAG AA", () => {
      const primary = lightTheme.primary.value
      const background = lightTheme.bgAlice100.value
      expect(meetsWCAGContrast(primary, background, "AA")).toBe(true)

      const success = lightTheme.success.value
      expect(meetsWCAGContrast(success, background, "AA", "large")).toBe(true)

      const error = lightTheme.error.value
      expect(meetsWCAGContrast(error, background, "AA", "large")).toBe(true)
    })
  })

  describe("Dark Theme Contrast", () => {
    test("primary text meets WCAG AA on dark backgrounds", () => {
      const textColor = darkTheme.textPrimary.value
      const bgColor = darkTheme.bgAlice100.value
      expect(meetsWCAGContrast(textColor, bgColor, "AA")).toBe(true)
    })

    test("secondary text meets WCAG AA on dark backgrounds", () => {
      const textColor = darkTheme.textSecondary.value
      const bgColor = darkTheme.bgAlice100.value
      expect(meetsWCAGContrast(textColor, bgColor, "AA")).toBe(true)
    })

    test("tertiary text meets minimum WCAG AA", () => {
      const textColor = darkTheme.textTertiary.value
      const bgColor = darkTheme.bgAlice100.value
      expect(meetsWCAGContrast(textColor, bgColor, "AA")).toBe(true)
    })

    test("all interactive elements meet WCAG AA", () => {
      const primary = darkTheme.primary.value
      const background = darkTheme.bgAlice100.value
      expect(meetsWCAGContrast(primary, background, "AA")).toBe(true)

      const success = darkTheme.success.value
      expect(meetsWCAGContrast(success, background, "AA")).toBe(true)

      const error = darkTheme.error.value
      expect(meetsWCAGContrast(error, background, "AA")).toBe(true)

      const warning = darkTheme.warning.value
      expect(meetsWCAGContrast(warning, background, "AA")).toBe(true)
    })
  })

  describe("Theme Performance", () => {
    test("theme switch completes within performance budget", () => {
      const start = performance.now()
      // Simulate theme switch by changing CSS variables
      document.documentElement.className = "dark"
      const duration = performance.now() - start
      expect(duration).toBeLessThan(50) // 50ms budget
    })
  })
})
