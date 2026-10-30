import { isIP } from "node:net";

const shorteners = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd",
  "buff.ly", "cutt.ly", "shorturl.at", "rebrand.ly", "tiny.cc"
]);
const suspiciousTerms = [
  "login", "log-in", "verify", "secure", "update", "banking",
  "password", "signin", "account", "confirm", "wallet", "credential"
];
const uncommonTlds = new Set([
  "zip", "mov", "click", "country", "gq", "tk", "ml", "cf", "work",
  "rest", "top", "xyz", "link", "support", "kim", "fit"
]);

function indicator(id, title, detail, points, severity = "warning") {
  return { id, title, detail, points, severity };
}

export function analyzeUrl(input) {
  if (typeof input !== "string") {
    throw new TypeError("Enter a website URL as text.");
  }
  if (/[\u0000-\u001f\u007f]/.test(input)) throw new TypeError("The URL contains invalid control characters.");
  const raw = input.trim();
  if (!raw) throw new TypeError("Enter a website URL to scan.");
  if (raw.length > 2048) throw new TypeError("URLs must be 2,048 characters or fewer.");
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
    throw new TypeError("Include http:// or https:// in the URL.");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError("Enter a valid website URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TypeError("Only HTTP and HTTPS website URLs can be analyzed.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new TypeError("Enter a URL with a hostname and no embedded credentials.");
  }
  if (parsed.href.length > 2048) throw new TypeError("Normalized URLs must be 2,048 characters or fewer.");
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const hostWithoutBrackets = hostname.replace(/^\[|\]$/g, "");
  const ipAddress = isIP(hostWithoutBrackets) !== 0;
  const labels = hostname.split(".");
  const tld = labels.length > 1 ? labels.at(-1) : "";
  const indicators = [];

  if (raw.length > 100) {
    indicators.push(indicator("long-url", "Unusually long URL", `${raw.length} characters can make the destination harder to inspect.`, 12));
  } else if (raw.length > 75) {
    indicators.push(indicator("url-length", "Long URL", `${raw.length} characters; long addresses can obscure the real destination.`, 6, "info"));
  }
  if (ipAddress) {
    indicators.push(indicator("ip-host", "IP address used as host", "The address points to a numeric IP instead of a recognizable domain.", 25, "danger"));
  }
  if (parsed.protocol !== "https:") {
    indicators.push(indicator("no-https", "HTTPS is not specified", "The URL uses HTTP. This scanner does not connect to the site or validate its TLS certificate.", 15));
  }
  if (raw.includes("@")) {
    indicators.push(indicator("at-symbol", "At symbol in URL", "An @ symbol can make text before it look like the destination when it is actually user information.", 18, "danger"));
  }
  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    indicators.push(indicator("many-hyphens", "Excessive hyphens in hostname", `Found ${hyphenCount} hyphens in the hostname.`, 12));
  } else if (hyphenCount >= 2) {
    indicators.push(indicator("hyphens", "Multiple hyphens in hostname", `Found ${hyphenCount} hyphens in the hostname.`, 6, "info"));
  }
  if (labels.length > 4) {
    indicators.push(indicator("subdomains", "Many subdomain levels", `The hostname has ${labels.length} labels; carefully check which domain is actually registered.`, 12));
  } else if (labels.length === 4 && labels[0] !== "www") {
    indicators.push(indicator("nested-subdomain", "Nested subdomains", "Nested subdomains can disguise the registrable domain.", 6, "info"));
  }
  if (shorteners.has(hostname)) {
    indicators.push(indicator("shortener", "URL shortening service", "The final destination is hidden behind a shortening service and is not followed by this scanner.", 15));
  }
  const matchedTerms = suspiciousTerms.filter((term) => `${hostname}${parsed.pathname}${parsed.search}`.toLowerCase().includes(term));
  if (matchedTerms.length > 0) {
    indicators.push(indicator("keywords", "Sensitive-action keywords", `Found: ${matchedTerms.slice(0, 5).join(", ")}. These words are not proof of malicious activity.`, Math.min(20, matchedTerms.length * 5)));
  }
  if (uncommonTlds.has(tld)) {
    indicators.push(indicator("uncommon-tld", "Less common domain extension", `The .${tld} extension is less common and deserves additional scrutiny.`, 10));
  }
  if (hostname.startsWith("xn--") || hostname.split(".").some((label) => label.startsWith("xn--"))) {
    indicators.push(indicator("punycode", "Internationalized hostname", "This hostname uses Punycode encoding; visually similar characters may be difficult to distinguish.", 12));
  }
  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    indicators.push(indicator("unusual-port", "Non-standard port", `The URL explicitly uses port ${parsed.port}.`, 8));
  }

  const riskScore = Math.min(100, indicators.reduce((total, item) => total + item.points, 0));
  const riskLevel = riskScore >= 70 ? "Critical" : riskScore >= 45 ? "High" : riskScore >= 20 ? "Medium" : "Low";
  const recommendations = riskScore >= 45
    ? ["Do not enter passwords, payment information, or verification codes on this site.", "Open the organization’s official website using a trusted bookmark or a URL you type yourself.", "If this link came in a message, verify it through a separate, trusted contact channel."]
    : riskScore >= 20
      ? ["Check the registrable domain carefully before proceeding.", "Avoid entering sensitive information unless you independently verify the website.", "Use an official bookmark or manually enter the organization’s known address."]
      : ["No major URL-based warning signs were detected; this is not proof the website is safe.", "Verify the domain independently before sharing sensitive information.", "Keep your browser and security software up to date."];

  return {
    normalizedUrl: parsed.href,
    hostname,
    https: parsed.protocol === "https:",
    riskScore,
    riskLevel,
    indicators,
    recommendations,
    reputation: { provider: "Google Safe Browsing", status: "not_configured", matches: [] }
  };
}
