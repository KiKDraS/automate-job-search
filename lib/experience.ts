/**
 * Total experience derived from the roles declared in `profile.md`.
 *
 * The user confirms role dates during setup; no total is stored anywhere.
 * Overlapping roles count once (unique calendar time); the raw sum of role
 * durations is kept as a reference. Career breaks are excluded. Callers must
 * read the computed value instead of hard-coding a number.
 */

export interface ExperienceRole {
  label: string
  start: string
  end: string
  startMonth: number
  endMonth: number
  months: number
  break: boolean
}

export interface ExperienceTotals {
  roles: ExperienceRole[]
  activeRoles: number
  breaks: number
  uniqueMonths: number
  sumMonths: number
  uniqueLabel: string
  sumLabel: string
  rounded: string
  warnings: string[]
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  ene: 0,
  enero: 0,
  feb: 1,
  february: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  apr: 3,
  april: 3,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  junio: 5,
  jul: 6,
  july: 6,
  julio: 6,
  aug: 7,
  august: 7,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septiembre: 8,
  set: 8,
  setiembre: 8,
  oct: 9,
  october: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  noviembre: 10,
  dec: 11,
  december: 11,
  dic: 11,
  diciembre: 11,
}

const RANGE_RE =
  /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,10})\.?\s+(\d{4})\s*[–—−-]\s*(present|actual|([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,10})\.?\s+(\d{4}))/gi

const ROLES_HEADING = /^##\s+roles\b/i
const ANY_HEADING = /^##\s+/
const LIST_ITEM = /^\s*[-*]\s+/
const BREAK_LABEL = /^(?:career break|break|pausa|licencia)\b/i

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function monthIndex(name: string, year: string): number | null {
  const month = MONTHS[stripDiacritics(name).toLowerCase()]
  const parsedYear = Number(year)
  if (month === undefined || !Number.isInteger(parsedYear)) return null
  return parsedYear * 12 + month
}

/** "6 years 9 months", "1 year", "3 months", or "0 months". */
export function formatMonths(months: number): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearPart = years === 0 ? "" : `${years} year${years === 1 ? "" : "s"}`
  const monthPart = rest === 0 ? "" : `${rest} month${rest === 1 ? "" : "s"}`
  if (yearPart !== "" && monthPart !== "") return `${yearPart} ${monthPart}`
  return yearPart !== "" ? yearPart : monthPart !== "" ? monthPart : "0 months"
}

/** Rounded, honest lower bound: 6y9m -> "6+ years"; under a year -> "less than 1 year". */
export function roundedYears(months: number): string {
  if (months < 12) return "less than 1 year"
  const years = Math.floor(months / 12)
  return `${years}+ year${years === 1 ? "" : "s"}`
}

function currentMonth(asOf: string | undefined): number {
  if (asOf === undefined) {
    const now = new Date()
    return now.getFullYear() * 12 + now.getMonth()
  }
  const match = /^(\d{4})-(\d{2})$/.exec(asOf.trim())
  if (match === null) {
    throw new Error(`invalid --as-of "${asOf}"; use YYYY-MM`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error(`invalid --as-of "${asOf}"; use YYYY-MM`)
  }
  return year * 12 + month - 1
}

/** Parse the `## Roles` section of a profile and compute the totals. */
export function computeExperience(profile: string, asOf?: string): ExperienceTotals {
  const endOfPresent = currentMonth(asOf)
  const lines = profile.split(/\r?\n/)
  const start = lines.findIndex((line) => ROLES_HEADING.test(line))
  if (start === -1) {
    return {
      roles: [],
      activeRoles: 0,
      breaks: 0,
      uniqueMonths: 0,
      sumMonths: 0,
      uniqueLabel: "0 months",
      sumLabel: "0 months",
      rounded: "not stated",
      warnings: ["no ## Roles section"],
    }
  }

  const roles: ExperienceRole[] = []
  const warnings: string[] = []

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (ANY_HEADING.test(line)) break
    if (!LIST_ITEM.test(line)) continue

    const label = (line.replace(LIST_ITEM, "").split(":")[0] ?? "").trim()
    const matches = [...line.matchAll(RANGE_RE)]
    const match = matches[matches.length - 1]
    if (match === undefined) {
      warnings.push(`role without a date range: ${label}`)
      continue
    }

    const startMonth = monthIndex(match[1] ?? "", match[2] ?? "")
    const endText = (match[3] ?? "").toLowerCase()
    const isPresent = endText === "present" || endText === "actual"
    const endMonth = isPresent ? endOfPresent : monthIndex(match[4] ?? "", match[5] ?? "")

    if (startMonth === null || endMonth === null) {
      warnings.push(`unreadable date range: ${label}`)
      continue
    }
    if (endMonth < startMonth) {
      warnings.push(`end before start: ${label}`)
      continue
    }

    roles.push({
      label,
      start: `${match[1] ?? ""} ${match[2] ?? ""}`.trim(),
      end: isPresent ? "Present" : `${match[4] ?? ""} ${match[5] ?? ""}`.trim(),
      startMonth,
      endMonth,
      months: endMonth - startMonth + 1,
      break: BREAK_LABEL.test(label),
    })
  }

  const active = roles.filter((role) => !role.break)
  const intervals = active
    .map((role) => ({ start: role.startMonth, end: role.endMonth }))
    .sort((left, right) => left.start - right.start)

  const merged: Array<{ start: number; end: number }> = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last !== undefined && interval.start <= last.end + 1) {
      if (interval.end > last.end) last.end = interval.end
      continue
    }
    merged.push({ ...interval })
  }

  const uniqueMonths = merged.reduce((total, interval) => total + interval.end - interval.start + 1, 0)
  const sumMonths = active.reduce((total, role) => total + role.months, 0)

  return {
    roles,
    activeRoles: active.length,
    breaks: roles.length - active.length,
    uniqueMonths,
    sumMonths,
    uniqueLabel: formatMonths(uniqueMonths),
    sumLabel: formatMonths(sumMonths),
    rounded: active.length === 0 ? "not stated" : roundedYears(uniqueMonths),
    warnings,
  }
}
