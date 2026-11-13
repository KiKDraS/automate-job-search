/**
 * ATS detection from a URL.
 *
 * Supported assisted-apply flows: LinkedIn Easy Apply, Greenhouse, and Lever.
 * Everything else is external and out of scope for v1.
 */

export type AtsKind = "linkedin" | "greenhouse" | "lever" | "external" | "unknown"

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/** Classify a URL by ATS. */
export function detectAts(value: string): AtsKind {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return "unknown"
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "unknown"
  const host = url.hostname.toLowerCase()
  if (hostMatches(host, "linkedin.com")) return "linkedin"
  if (hostMatches(host, "greenhouse.io")) return "greenhouse"
  if (hostMatches(host, "lever.co")) return "lever"
  return "external"
}

/** True for the ATSs the assisted apply flows support. */
export function isSupportedAts(kind: AtsKind): kind is "linkedin" | "greenhouse" | "lever" {
  return kind === "linkedin" || kind === "greenhouse" || kind === "lever"
}
