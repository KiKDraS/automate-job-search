/**
 * Company preferences — machine-readable "keep receiving offers" flags.
 *
 * The report writes this overlay; `preferences.md` stays the human-authored
 * source. Search, feed, and backlog merge both and skip companies with
 * `receiveOffers: false`.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeKey } from "./applied.ts"

export const COMPANY_PREFERENCES_FILE = path.join("state", "company-preferences.json")

export interface CompanyPreference {
  company: string
  receiveOffers: boolean
  updatedAt: string
}

export interface CompanyPreferences {
  schema: 1
  companies: Record<string, CompanyPreference>
}

export function emptyCompanyPreferences(): CompanyPreferences {
  return { schema: 1, companies: {} }
}

export function parseCompanyPreferences(source: string): CompanyPreferences | null {
  try {
    const parsed = JSON.parse(source) as {
      schema?: unknown
      companies?: unknown
    }
    if (parsed.schema !== 1 || typeof parsed.companies !== "object" || parsed.companies === null) {
      return null
    }
    const companies: Record<string, CompanyPreference> = {}
    for (const [key, value] of Object.entries(parsed.companies)) {
      if (typeof value !== "object" || value === null) continue
      const entry = value as Record<string, unknown>
      if (
        typeof entry["company"] !== "string" ||
        typeof entry["receiveOffers"] !== "boolean" ||
        typeof entry["updatedAt"] !== "string"
      ) {
        continue
      }
      const normalized = normalizeKey(key)
      if (normalized === "") continue
      companies[normalized] = {
        company: entry["company"],
        receiveOffers: entry["receiveOffers"],
        updatedAt: entry["updatedAt"],
      }
    }
    return { schema: 1, companies }
  } catch {
    return null
  }
}

export function formatCompanyPreferences(preferences: CompanyPreferences): string {
  return `${JSON.stringify(preferences, null, 2)}\n`
}

export async function readCompanyPreferences(dataDir: string): Promise<CompanyPreferences> {
  const source = await fs
    .readFile(path.join(dataDir, COMPANY_PREFERENCES_FILE), "utf8")
    .catch(() => null)
  if (source === null) return emptyCompanyPreferences()
  return parseCompanyPreferences(source) ?? emptyCompanyPreferences()
}

async function writeCompanyPreferences(
  dataDir: string,
  preferences: CompanyPreferences,
): Promise<void> {
  const target = path.join(dataDir, COMPANY_PREFERENCES_FILE)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, formatCompanyPreferences(preferences))
  await fs.rename(temporary, target)
}

/** Set a company's preference. `receiveOffers: true` removes the exclusion. */
export async function setCompanyPreference(
  dataDir: string,
  company: string,
  receiveOffers: boolean,
  now: string = new Date().toISOString(),
): Promise<CompanyPreferences> {
  const name = company.trim()
  if (name === "") throw new Error("company is required")
  if (name.length > 120) throw new Error("company is too long")
  const key = normalizeKey(name)
  if (key === "") throw new Error("company is not a valid name")
  const preferences = await readCompanyPreferences(dataDir)
  if (receiveOffers) {
    delete preferences.companies[key]
  } else {
    preferences.companies[key] = { company: name, receiveOffers: false, updatedAt: now }
  }
  await writeCompanyPreferences(dataDir, preferences)
  return preferences
}

export function isCompanyExcluded(
  preferences: CompanyPreferences,
  company: string,
): boolean {
  const entry = preferences.companies[normalizeKey(company)]
  return entry !== undefined && entry.receiveOffers === false
}

export function excludedCompanies(preferences: CompanyPreferences): string[] {
  return Object.values(preferences.companies)
    .filter((entry) => entry.receiveOffers === false)
    .map((entry) => entry.company)
    .sort((left, right) => left.localeCompare(right))
}
