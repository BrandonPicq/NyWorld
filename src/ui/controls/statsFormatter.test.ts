import { describe, expect, it } from "vitest";
import { formatCurrency, capitalize } from "./statsFormatter";

describe("statsFormatter", () => {
  describe("formatCurrency", () => {
    it("handles zero bronze coins", () => {
      expect(formatCurrency(0)).toBe("0b");
    });

    it("formats pure bronze values", () => {
      expect(formatCurrency(45)).toBe("45b");
    });

    it("converts bronze to silver", () => {
      expect(formatCurrency(1550)).toBe("15s 50b");
    });

    it("omits bronze if it is zero and higher coins exist", () => {
      expect(formatCurrency(200)).toBe("2s");
    });

    it("formats gold values", () => {
      expect(formatCurrency(234500)).toBe("23g 45s");
      expect(formatCurrency(234567)).toBe("23g 45s 67b");
    });

    it("formats platinum values", () => {
      expect(formatCurrency(12345678)).toBe("12p 34g 56s 78b");
    });
  });

  describe("capitalize", () => {
    it("capitalizes words", () => {
      expect(capitalize("strength")).toBe("Strength");
      expect(capitalize("intelligence")).toBe("Intelligence");
    });

    it("handles empty values", () => {
      expect(capitalize("")).toBe("");
    });
  });
});
