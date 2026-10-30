import test from "node:test";
import assert from "node:assert/strict";
import { analyzeUrl } from "./analyzer.js";

test("accepts HTTPS URLs without claiming they are safe", () => {
  const result = analyzeUrl("https://example.com");
  assert.equal(result.https, true);
  assert.equal(result.riskLevel, "Low");
  assert.equal(result.reputation.status, "not_configured");
  assert.match(result.recommendations[0], /not proof/i);
});

test("flags multiple URL risk indicators", () => {
  const result = analyzeUrl("http://verify-login-account.example-evil.xyz/path");
  assert.equal(result.https, false);
  assert.ok(result.indicators.some((item) => item.id === "no-https"));
  assert.ok(result.indicators.some((item) => item.id === "keywords"));
  assert.ok(result.riskScore >= 20);
});

test("flags IP hosts, URL shorteners, and at symbols", () => {
  const ip = analyzeUrl("http://192.0.2.1/login");
  const shortener = analyzeUrl("https://bit.ly/abc");
  assert.ok(ip.indicators.some((item) => item.id === "ip-host"));
  assert.ok(shortener.indicators.some((item) => item.id === "shortener"));
  assert.throws(() => analyzeUrl("https://user@example.com"), /embedded credentials/);
});

test("rejects malformed, unsupported, or incomplete input", () => {
  for (const value of ["", "example.com", "ftp://example.com", "https://", "https://example.com\n"]) {
    assert.throws(() => analyzeUrl(value));
  }
});

test("rejects URLs that exceed the storage limit after normalization", () => {
  const url = `https://example.com/${" ".repeat(1000)}x`;
  assert.throws(() => analyzeUrl(url), /Normalized URLs must be 2,048 characters or fewer/);
});
