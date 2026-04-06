import { describe, it, expect, beforeEach } from "vitest";
import { classify } from "../../src/extract/classifier.js";
import { resetConfig } from "../../src/utils/config.js";

describe("classifier", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("classifies decision patterns", () => {
    const result = classify(
      "After evaluating the options, I've decided to use PostgreSQL for the main database.",
      "transcript",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("decision");
    expect(result!.confidence).toBeGreaterThan(0.4);
  });

  it("classifies constraint patterns", () => {
    const result = classify(
      "We must always use 2-space indentation. Never use tabs in this project.",
      "transcript",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("constraint");
  });

  it("classifies convention patterns", () => {
    const result = classify(
      "The convention is to use kebab-case for all API endpoint URLs consistently.",
      "transcript",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("convention");
  });

  it("classifies bug-lesson patterns", () => {
    const result = classify(
      "The issue was a race condition in the webhook handler. The root cause was missing locks.",
      "transcript",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("bug-lesson");
  });

  it("returns null for non-matching text", () => {
    const result = classify(
      "Let me check the file contents for you now.",
      "transcript",
    );
    expect(result).toBeNull();
  });

  it("applies compact_summary confidence bonus", () => {
    const transcriptResult = classify(
      "After evaluating the options, I've decided to use PostgreSQL for the main database.",
      "transcript",
    );
    const compactResult = classify(
      "After evaluating the options, I've decided to use PostgreSQL for the main database.",
      "compact_summary",
    );
    expect(transcriptResult).not.toBeNull();
    expect(compactResult).not.toBeNull();
    expect(compactResult!.confidence).toBeGreaterThan(
      transcriptResult!.confidence,
    );
  });

  it("gives user source confidence 1.0", () => {
    const result = classify(
      "We decided to use PostgreSQL for all data storage needs in this project.",
      "user",
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1.0);
  });

  it("rejects segments longer than 300 characters", () => {
    const longText =
      "We decided to use PostgreSQL for the main database. " +
      "This was after a long evaluation of many different database options including MySQL, MariaDB, CockroachDB, and others. " +
      "We considered factors like JSON support, full-text search, replication, and community support. " +
      "In the end PostgreSQL was chosen because it provides the best combination of features for our specific use case requirements and constraints.";
    expect(longText.length).toBeGreaterThan(300);
    const result = classify(longText, "transcript");
    expect(result).toBeNull();
  });
});
