import { describe, it, expect } from "vitest";
import { computeFingerprint } from "../../src/extract/fingerprint.js";

describe("fingerprint", () => {
  it("produces deterministic hash", () => {
    const a = computeFingerprint("Use PostgreSQL", "decision");
    const b = computeFingerprint("Use PostgreSQL", "decision");
    expect(a).toBe(b);
  });

  it("normalizes whitespace", () => {
    const a = computeFingerprint("Use   PostgreSQL", "decision");
    const b = computeFingerprint("Use PostgreSQL", "decision");
    expect(a).toBe(b);
  });

  it("normalizes case", () => {
    const a = computeFingerprint("Use PostgreSQL", "decision");
    const b = computeFingerprint("use postgresql", "decision");
    expect(a).toBe(b);
  });

  it("differs by category", () => {
    const a = computeFingerprint("Use PostgreSQL", "decision");
    const b = computeFingerprint("Use PostgreSQL", "convention");
    expect(a).not.toBe(b);
  });

  it("differs by content", () => {
    const a = computeFingerprint("Use PostgreSQL", "decision");
    const b = computeFingerprint("Use MySQL", "decision");
    expect(a).not.toBe(b);
  });

  it("produces hex string", () => {
    const fp = computeFingerprint("test content", "decision");
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
