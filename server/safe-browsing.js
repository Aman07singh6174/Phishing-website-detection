const endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export async function checkSafeBrowsing(url, apiKey) {
  if (!apiKey) {
    return { provider: "Google Safe Browsing", status: "not_configured", matches: [] };
  }

  try {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        client: { clientId: "phishguard", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });
    if (!response.ok) {
      return { provider: "Google Safe Browsing", status: "error", matches: [], message: `Threat-intelligence provider returned HTTP ${response.status}.` };
    }
    const body = await response.json();
    const matches = Array.isArray(body.matches) ? body.matches.map((match) => ({
      threatType: match.threatType || "UNKNOWN",
      platformType: match.platformType || "UNKNOWN"
    })) : [];
    return { provider: "Google Safe Browsing", status: matches.length ? "match" : "no_match", matches };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      provider: "Google Safe Browsing",
      status: "error",
      matches: [],
      message: timedOut ? "Threat-intelligence check timed out." : "Threat-intelligence provider could not be reached."
    };
  }
}
