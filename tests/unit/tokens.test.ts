import { describe, it, expect } from "vitest";
import { estimateTokens } from "../../src/utils/tokens.js";

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("rounds up", () => {
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("handles empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("handles longer text", () => {
    const text = "a".repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});
