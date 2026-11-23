import assert from "node:assert/strict"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { migrateDataDirectory, parseDataDirConfig, resolveDataDirWithSource } from "../lib/data-dir.ts"
import {
  automationReady,
  buildScheduledPrompt,
  DEFAULT_AUTOMATION,
  formatAutomationConfig,
  nextRunAt,
  parseAutomationConfig,
  parseTimes,
  validateAutomationConfig,
  type PendingState,
} from "../lib/automation.ts"
import {
  buildCronLines,
  buildLaunchdPlist,
  buildPosixWrapper,
  buildSystemdTimer,
  buildWindowsTaskArgs,
  buildWindowsWrapper,
  detectScheduler,
  intervalHours,
  windowsTaskName,
} from "../lib/scheduler.ts"
import { buildNotificationCommand } from "../lib/notify.ts"
import { buildOpenCommand } from "../lib/open.ts"
import { buildReportHtml, formatPendingSummary } from "../lib/report-html.ts"
import { resolveOpencodeDefaultModel } from "../lib/model.ts"
import {
  applicationsWrittenSince,
  canRetryRun,
  isTransportFailure,
} from "../lib/retry.ts"
import {
  buildRuntimeOpencodeConfig,
  compareRuntime,
  isInsidePath,
  parseRuntimeManifest,
  playwrightProfileDir,
  protectedPath,
  resolveRuntimeDir,
  runtimeBrowserProfileDir,
  safePathEnv,
  seedBrowserProfile,
  syncRuntime,
} from "../lib/runtime.ts"
import {
  findNodePath,
  findOpencodeOnPath,
  knownOpencodePaths,
  resolveOpencodePath,
} from "../lib/opencode-bin.ts"
import {
  formatApplicationIndexRow,
  formatAppliedMarkdown,
  parseAppliedEntry,
  parseAppliedMarkdown,
  upsertApplicationIndexRow,
} from "../lib/apply.ts"
import { cleanupExpiredData } from "../lib/cleanup.ts"
import {
  companyRoleKey,
  isApplied,
  listBacklogFolders,
  normalizeAppliedUrl,
  readAppliedIndex,
} from "../lib/applied.ts"
import { isLikelyScanned, joinPages } from "../lib/resume-text.ts"
import { detectAts } from "../lib/ats.ts"
import {
  buildJobSearchUrl,
  jobIdFromUrl,
  normalizeJobUrl,
  normalizeUrl,
} from "../lib/linkedin-url.ts"
import {
  appendHistory,
  duplicateKey,
  filterNew,
  formatHistorySection,
  jobFolderName,
  slugify,
  todayIso,
} from "../lib/jobstore.ts"
import { checkStack, extractTerms, parseDeclaredStack, splitPostingSections } from "../lib/stack-check.ts"
import {
  mergeCatalog,
  parseCatalog,
  TECH_CATALOG,
  validateCatalog,
} from "../lib/tech-catalog.ts"
import { buildPostingMarkdown, unwrapEvalResult } from "../lib/posting.ts"
import { buildResumeHtml, markdownToHtml } from "../lib/resume-html.ts"
import { buildFeedMarkdown } from "../lib/feed.ts"
import { buildMailto, parseEmailDraft } from "../lib/email.ts"

test("buildJobSearchUrl supports a two-day window", () => {
  const url = new URL(
    buildJobSearchUrl({ keywords: "react developer", postedWithin: "48h" }),
  )
  assert.equal(url.searchParams.get("f_TPR"), "r172800")
})

test("parseEmailDraft and buildMailto produce a handoff", () => {
  const draft = parseEmailDraft(`# Application email — React Developer at Acme

- To: jobs@acme.com
- Subject: Application — React Developer — Ana Pérez
- Status: draft, not sent

## Body

Hola, me interesa el rol.

Adjunto mi CV.

## Evidence

| Claim | Source |
`)
  assert.notEqual(draft, null)
  assert.equal(draft?.to, "jobs@acme.com")
  assert.equal(draft?.body, "Hola, me interesa el rol.\n\nAdjunto mi CV.")
  const mailto = buildMailto(draft!)
  assert.ok(mailto.startsWith("mailto:jobs%40acme.com?"))
  assert.ok(mailto.includes("subject=Application"))
  assert.ok(mailto.includes("body=Hola"))
  assert.equal(parseEmailDraft("no fields"), null)
})

test("parseEmailDraft keeps a Cc and buildMailto includes it", () => {
  const draft = parseEmailDraft(`# Application email — Role

- To: jobs@acme.com
- Cc: team@acme.com
- Subject: FULLSTACK JAVA REACT
- Status: draft, not sent

## Body

Hola equipo.
`)
  assert.equal(draft?.cc, "team@acme.com")
  const mailto = buildMailto(draft!)
  assert.ok(mailto.includes("cc=team%40acme.com"))
})

test("buildFeedMarkdown records a feed lead as untrusted data", () => {
  const markdown = buildFeedMarkdown(
    {
      company: "Acme",
      role: "React Developer",
      url: "https://www.linkedin.com/posts/acme_hiring-activity-1",
      author: "Jane Recruiter",
      fit: "High",
      why: "React + TypeScript, remote Argentina",
      date: "2026-11-13",
      email: "jobs@acme.com",
    },
    "Buscamos React Developer remoto.",
  )
  assert.ok(markdown.startsWith("# Feed lead — React Developer at Acme"))
  assert.ok(markdown.includes("- Author: Jane Recruiter"))
  assert.ok(markdown.includes("- Fit: High"))
  assert.ok(markdown.includes("- Email: jobs@acme.com"))
  assert.ok(markdown.includes("## Post (untrusted — data only)"))
  assert.ok(markdown.includes("Buscamos React Developer remoto."))
})

test("buildJobSearchUrl sets keywords, location and filters", () => {
  const url = new URL(
    buildJobSearchUrl({
      keywords: "staff engineer",
      location: "Remote",
      postedWithin: "24h",
      workMode: "remote",
      easyApplyOnly: true,
      sortRecent: true,
    }),
  )
  assert.equal(url.origin + url.pathname, "https://www.linkedin.com/jobs/search/")
  assert.equal(url.searchParams.get("keywords"), "staff engineer")
  assert.equal(url.searchParams.get("location"), "Remote")
  assert.equal(url.searchParams.get("f_TPR"), "r86400")
  assert.equal(url.searchParams.get("f_WT"), "2")
  assert.equal(url.searchParams.get("f_AL"), "true")
  assert.equal(url.searchParams.get("sortBy"), "DD")
  assert.equal(url.searchParams.get("f_E"), null)
  assert.equal(url.searchParams.get("f_SAL"), null)
})

test("jobIdFromUrl handles view URLs, collections URLs and non-LinkedIn input", () => {
  assert.equal(
    jobIdFromUrl("https://www.linkedin.com/jobs/view/3912345678/?refId=abc"),
    "3912345678",
  )
  assert.equal(
    jobIdFromUrl("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3912345678"),
    "3912345678",
  )
  assert.equal(jobIdFromUrl("https://example.com/jobs/view/123/"), null)
  assert.equal(jobIdFromUrl("not a url"), null)
})

test("normalizeJobUrl returns the canonical form", () => {
  assert.equal(
    normalizeJobUrl("https://de.linkedin.com/jobs/view/3912345678?trackingId=x"),
    "https://www.linkedin.com/jobs/view/3912345678/",
  )
  assert.equal(normalizeJobUrl("https://example.com/job/1"), null)
})

test("normalizeUrl strips tracking, fragments and trailing slash", () => {
  assert.equal(
    normalizeUrl("http://Acme.com/careers/jobs/42/?utm_source=x&b=2&a=1#apply"),
    "https://acme.com/careers/jobs/42?a=1&b=2",
  )
  assert.equal(normalizeUrl("mailto:jobs@acme.com"), null)
})

test("detectAts classifies supported ATS and external URLs", () => {
  assert.equal(detectAts("https://www.linkedin.com/jobs/view/123/"), "linkedin")
  assert.equal(detectAts("https://de.linkedin.com/jobs/view/123/"), "linkedin")
  assert.equal(detectAts("https://job-boards.greenhouse.io/canonical/jobs/5150422"), "greenhouse")
  assert.equal(detectAts("https://boards.greenhouse.io/acme/jobs/123"), "greenhouse")
  assert.equal(detectAts("https://jobs.lever.co/RyzLabs/abc/apply"), "lever")
  assert.equal(detectAts("https://jobs.eu.lever.co/acme/123"), "lever")
  assert.equal(detectAts("https://example.com/apply"), "external")
  assert.equal(detectAts("not-a-url"), "unknown")
  assert.equal(detectAts("mailto:jobs@acme.com"), "unknown")
})

test("slugify is filesystem-safe and never empty", () => {
  assert.equal(slugify("Acme Corp. (EU)"), "acme-corp-eu")
  assert.equal(slugify("Ana Pérez"), "ana-perez")
  assert.equal(slugify("!!!"), "untitled")
  assert.ok(slugify("x".repeat(80)).length <= 40)
})

test("slugify truncates on a word boundary", () => {
  assert.equal(
    slugify("Web Frontend Engineer — JS, CSS, React, Flutter"),
    "web-frontend-engineer-js-css-react",
  )
  assert.equal(
    jobFolderName("Canonical", "Web Frontend Engineer — JS, CSS, React, Flutter", "2026-10-22"),
    "canonical-web-frontend-engineer-js-css-react-2026-10-22",
  )
})

test("duplicateKey ignores case and punctuation", () => {
  const a = duplicateKey({ title: "Senior Engineer, Backend", company: "Acme", location: "Remote" })
  const b = duplicateKey({ title: "senior engineer backend", company: "ACME", location: "remote" })
  assert.equal(a, b)
  const c = duplicateKey({ title: "Senior Engineer, Backend", company: "Acme", location: "Berlin" })
  assert.notEqual(a, c)
})

test("jobFolderName combines slugs and date", () => {
  assert.equal(jobFolderName("Acme Corp", "Staff Engineer", "2026-10-14"), "acme-corp-staff-engineer-2026-10-14")
})

test("formatHistorySection writes a valid table and sanitizes pipes", () => {
  const section = formatHistorySection("2026-10-14", 'backend "remote"', [
    {
      title: "Staff Engineer | Platform",
      company: "Acme",
      location: "Remote",
      salary: "not stated",
      fit: "High",
      notes: "strong match",
    },
  ])
  assert.ok(section.startsWith(`## [2026-10-14] - Search: "backend 'remote'"`))
  assert.ok(section.includes("| Staff Engineer / Platform | Acme |"))
  assert.ok(section.includes("| High | strong match |"))
})

test("todayIso formats local dates", () => {
  assert.equal(todayIso(new Date(2026, 0, 5)), "2026-01-05")
})

test("parseDataDirConfig accepts valid configs and rejects invalid ones", () => {
  assert.equal(parseDataDirConfig('{"dataDir":"/tmp/x"}'), "/tmp/x")
  assert.equal(parseDataDirConfig('{"dataDir":"  "}'), null)
  assert.equal(parseDataDirConfig('{"other":1}'), null)
  assert.equal(parseDataDirConfig("not json"), null)
})

test("joinPages normalizes whitespace and drops empty pages", () => {
  assert.equal(joinPages(["  Hello   world ", "", "Second\r\npage"]), "Hello world\n\nSecond\npage")
})

test("isLikelyScanned flags near-empty extraction output", () => {
  assert.equal(isLikelyScanned(""), true)
  assert.equal(isLikelyScanned("short"), true)
  assert.equal(isLikelyScanned("x".repeat(300)), false)
})

test("data dir resolution: env wins, config second, default last", () => {
  const prevEnv = process.env["JOBSEARCH_HOME"]
  const prevXdg = process.env["XDG_CONFIG_HOME"]
  const tmp = mkdtempSync(path.join(os.tmpdir(), "jobsearch-datadir-"))
  try {
    mkdirSync(path.join(tmp, "opencode"), { recursive: true })
    const configFile = path.join(tmp, "opencode", "jobsearch.json")
    writeFileSync(configFile, '{"dataDir":"/tmp/from-config"}')
    process.env["XDG_CONFIG_HOME"] = tmp

    process.env["JOBSEARCH_HOME"] = "/tmp/from-env"
    const fromEnv = resolveDataDirWithSource()
    assert.equal(fromEnv.source, "env")
    assert.equal(fromEnv.dir, "/tmp/from-env")

    delete process.env["JOBSEARCH_HOME"]
    const fromConfig = resolveDataDirWithSource()
    assert.equal(fromConfig.source, "config")
    assert.equal(fromConfig.dir, "/tmp/from-config")

    writeFileSync(configFile, "{}")
    const fromDefault = resolveDataDirWithSource()
    assert.equal(fromDefault.source, "default")
  } finally {
    if (prevEnv === undefined) delete process.env["JOBSEARCH_HOME"]
    else process.env["JOBSEARCH_HOME"] = prevEnv
    if (prevXdg === undefined) delete process.env["XDG_CONFIG_HOME"]
    else process.env["XDG_CONFIG_HOME"] = prevXdg
    rmSync(tmp, { recursive: true, force: true })
  }
})

test("filterNew removes duplicates against history and within the batch", () => {
  const seen = new Set([duplicateKey({ title: "A", company: "X", location: "R" })])
  const candidates = [
    { title: "A", company: "X", location: "R" },
    { title: "B", company: "Y", location: "R", url: "https://example.com/b" },
    { title: "B", company: "Y", location: "R" },
    { title: "C", company: "Z", location: "R" },
  ]
  const fresh = filterNew(candidates, seen)
  assert.deepEqual(
    fresh.map((candidate) => candidate.title),
    ["B", "C"],
  )
  assert.equal(fresh[0]?.url, "https://example.com/b")
})

test("appendHistory skips duplicates against history and within the section", async () => {
  const prevEnv = process.env["JOBSEARCH_HOME"]
  const tmp = mkdtempSync(path.join(os.tmpdir(), "jobsearch-history-"))
  process.env["JOBSEARCH_HOME"] = tmp
  try {
    const record = {
      title: "Senior Software Engineer, Build Loop",
      company: "Webflow",
      location: "Buenos Aires y alrededores (En remoto)",
      salary: "not stated",
      fit: "Low" as const,
      notes: "duplicate check",
    }
    const first = await appendHistory("2026-10-22", "test", [record, { ...record }])
    assert.deepEqual(first, { appended: 1, skipped: 1 })

    const second = await appendHistory("2026-10-22", "test", [record])
    assert.deepEqual(second, { appended: 0, skipped: 1 })

    const text = readFileSync(path.join(tmp, "job-history.md"), "utf8")
    assert.equal(text.match(/\| Senior Software Engineer, Build Loop \|/g)?.length, 1)
  } finally {
    if (prevEnv === undefined) delete process.env["JOBSEARCH_HOME"]
    else process.env["JOBSEARCH_HOME"] = prevEnv
    rmSync(tmp, { recursive: true, force: true })
  }
})

const FRONTEND_PROFILE = `# Profile

## Stack
- Primary: TypeScript, React, CSS, HTML
- Working knowledge: Node.js, Vite, Figma
`

const ANGULAR_PROFILE = `# Profile

## Stack
- Primary: Angular, TypeScript, CSS
`

const JAVA_PROFILE = `# Profile

## Stack
- Primary: Java, Spring Boot, SQL
`

const PREFERENCES = `# Job Preferences

- Target roles: Front-End Developer / Desarrollador Front-End; React Developer
`

test("stack check reads the declared stack instead of assuming one", () => {
  assert.deepEqual(parseDeclaredStack(FRONTEND_PROFILE), {
    primary: ["TypeScript", "React", "CSS", "HTML"],
    working: ["Node.js", "Vite", "Figma"],
  })
  assert.equal(parseDeclaredStack("# Profile\n\n## Skills\n\nReact, TypeScript"), null)
})

test("stack check classifies required and optional posting terms", () => {
  const sections = splitPostingSections(
    "## Requirements\n\nAngular, TypeScript, CSS.\n\n## Nice to have\n\nVue.",
  )
  assert.equal(sections.sectionsFound, true)
  assert.ok(sections.required.includes("Requirements"))
  assert.ok(sections.required.includes("Angular, TypeScript, CSS."))
  assert.ok(sections.optional.includes("Nice to have"))
  assert.ok(sections.optional.includes("Vue."))
  assert.deepEqual(
    extractTerms("Angular, .NET Core, C#, Java, JavaScript, TypeScript, PostgreSQL"),
    [".NET", "Angular", "C#", "Java", "JavaScript", "PostgreSQL", "TypeScript"],
  )
})

test("stack check adapts to different user stacks", () => {
  const posting =
    "## Requirements\n\nAngular, TypeScript, CSS.\n\n## Nice to have\n\nVue."

  const frontend = checkStack(posting, FRONTEND_PROFILE, PREFERENCES)
  assert.ok(frontend !== null)
  assert.deepEqual(frontend.targetRoles, [
    "Front-End Developer / Desarrollador Front-End",
    "React Developer",
  ])
  assert.equal(frontend.sectionsFound, true)
  assert.deepEqual(frontend.required, ["Angular", "CSS", "TypeScript"])
  assert.deepEqual(frontend.optional, ["Vue"])
  assert.deepEqual(frontend.matched, ["CSS", "TypeScript"])
  assert.deepEqual(frontend.requiredNotInStack, ["Angular"])
  assert.deepEqual(frontend.optionalNotInStack, ["Vue"])

  const angular = checkStack(posting, ANGULAR_PROFILE)
  assert.ok(angular !== null)
  assert.deepEqual(angular.matched, ["Angular", "CSS", "TypeScript"])
  assert.deepEqual(angular.requiredNotInStack, [])
  assert.deepEqual(angular.optionalNotInStack, ["Vue"])

  const java = checkStack("## Requirements\n\nJava, Spring Boot, SQL.", JAVA_PROFILE)
  assert.ok(java !== null)
  assert.deepEqual(java.requiredNotInStack, [])

  assert.equal(checkStack(posting, "# Profile\n\n## Skills\n\nReact"), null)
})

test("stack check marks sectionsFound false when the posting has no headings", () => {
  const result = checkStack("We use Angular and React.", FRONTEND_PROFILE)
  assert.ok(result !== null)
  assert.equal(result.sectionsFound, false)
  assert.deepEqual(result.required, [])
  assert.deepEqual(result.optional, [])
  assert.deepEqual(result.mentioned, ["Angular", "React"])
  assert.deepEqual(result.requiredNotInStack, [])
  assert.deepEqual(result.optionalNotInStack, [])
})

test("tech catalog validation catches duplicate names and alias collisions", () => {
  assert.deepEqual(validateCatalog(TECH_CATALOG), [])
  assert.ok(
    validateCatalog([
      { name: "A", aliases: ["a"] },
      { name: "A", aliases: ["b"] },
    ]).some((error) => error.includes("duplicate name")),
  )
  assert.ok(
    validateCatalog([
      { name: "A", aliases: ["x"] },
      { name: "B", aliases: ["x"] },
    ]).some((error) => error.includes("used by")),
  )
  assert.ok(
    validateCatalog([{ name: "A", aliases: [] }]).some((error) => error.includes("no aliases")),
  )
})

test("tech catalog merges the local overlay and parses its JSON", () => {
  const merged = mergeCatalog(
    [{ name: "React", aliases: ["react"] }],
    [
      { name: "React", aliases: ["react.js"] },
      { name: "Stake Engine", aliases: ["stake engine"] },
    ],
  )
  assert.deepEqual(merged, [
    { name: "React", aliases: ["react", "react.js"] },
    { name: "Stake Engine", aliases: ["stake engine"] },
  ])
  assert.deepEqual(validateCatalog(merged), [])

  assert.deepEqual(
    parseCatalog('{"terms":[{"name":"Stake Engine","aliases":["stake engine"]}]}'),
    [{ name: "Stake Engine", aliases: ["stake engine"] }],
  )
  assert.throws(() => parseCatalog('{"terms":"nope"}'))
  assert.throws(() => parseCatalog('{"terms":[{"name":"","aliases":[]}]}'))
})

test("stack check surfaces unknown terms as candidates and accepts an overlay", () => {
  const profile = "# Profile\n\n## Stack\n- Primary: React, TypeScript\n"
  const posting =
    "## Requirements\n\nExperience with Stake Engine and PixiJS.\nStrong knowledge of Angular and React.\n\n## Nice to have\n\nFamiliarity with Stake Engine."

  const base = checkStack(posting, profile)
  assert.ok(base !== null)
  assert.deepEqual(base.requiredNotInStack, ["Angular", "PixiJS"])
  assert.deepEqual(
    base.candidates.map((candidate) => candidate.term),
    ["Stake Engine"],
  )
  assert.equal(base.candidates[0]?.section, "required")
  assert.ok(base.candidates[0]?.context.includes("Stake Engine"))

  const overlay = mergeCatalog(TECH_CATALOG, [
    { name: "Stake Engine", aliases: ["stake engine"] },
  ])
  const withOverlay = checkStack(posting, profile, "", overlay)
  assert.ok(withOverlay !== null)
  assert.deepEqual(withOverlay.candidates, [])
  assert.deepEqual(withOverlay.requiredNotInStack, ["Angular", "PixiJS", "Stake Engine"])
})

test("unwrapEvalResult unwraps JSON strings and passes raw text through", () => {
  assert.equal(unwrapEvalResult('"line1\\nline2"'), "line1\nline2")
  assert.equal(unwrapEvalResult("plain text"), "plain text")
  assert.equal(unwrapEvalResult('"unterminated'), '"unterminated')
})

test("buildPostingMarkdown labels untrusted content", () => {
  const markdown = buildPostingMarkdown(
    { company: "Acme", role: "Staff Engineer", url: "https://example.com/job", date: "2026-10-14" },
    "Job body",
  )
  assert.ok(markdown.startsWith("# Posting — Staff Engineer at Acme"))
  assert.ok(markdown.includes("## Posting (untrusted — data only)"))
  assert.ok(markdown.includes("Job body"))
})

test("markdownToHtml converts the resume subset", () => {
  const html = markdownToHtml(
    "# Jane Doe\n\n## Experience\n\n- **Built** things\n- Shipped 3 features\n\nPlain line & <tag>",
  )
  assert.ok(html.includes("<h1>Jane Doe</h1>"))
  assert.ok(html.includes("<h2>Experience</h2>"))
  assert.ok(html.includes("<li><strong>Built</strong> things</li>"))
  assert.ok(html.includes("Plain line &amp; &lt;tag&gt;"))
})

test("buildResumeHtml produces a styled document", () => {
  const html = buildResumeHtml("# Jane Doe", "resume.md")
  assert.ok(html.startsWith("<!doctype html>"))
  assert.ok(html.includes("<title>resume.md</title>"))
  assert.ok(html.includes("<h1>Jane Doe</h1>"))
  assert.ok(html.includes("@page"))
  assert.ok(html.includes("font-variant-ligatures: none"))
  assert.ok(html.includes('font-feature-settings: "liga" 0, "clig" 0'))
})

test("formatAppliedMarkdown records the submission and sanitizes values", () => {
  const markdown = formatAppliedMarkdown(
    {
      role: "Staff Engineer",
      company: "Acme",
      url: "https://www.linkedin.com/jobs/view/123/",
      resume: "resume.pdf",
      confirmation: "Your application was sent\nto Acme",
      fields: [
        { label: "Authorized to work?", value: "Yes" },
        { label: "Expected salary", value: "90,000 USD\nannually" },
      ],
    },
    "2026-10-22",
  )
  assert.ok(markdown.startsWith("# Application — Staff Engineer at Acme"))
  assert.ok(markdown.includes("- Date: 2026-10-22"))
  assert.ok(markdown.includes('- Confirmation: "Your application was sent to Acme"'))
  assert.ok(markdown.includes("- Cover letter: not requested"))
  assert.ok(markdown.includes("- Expected salary: 90,000 USD annually"))
})

test("formatAppliedMarkdown records the ATS method", () => {
  const base = {
    role: "Staff Engineer",
    company: "Acme",
    url: "https://example.com/job",
    resume: "resume.pdf",
    confirmation: "sent",
  }
  assert.ok(formatAppliedMarkdown(base, "2026-10-22").includes("- Method: LinkedIn Easy Apply"))
  assert.ok(
    formatAppliedMarkdown({ ...base, method: "Greenhouse" }, "2026-10-22").includes(
      "- Method: Greenhouse",
    ),
  )
})

test("parseAppliedEntry accepts valid entries and rejects incomplete ones", () => {
  const entry = parseAppliedEntry(
    JSON.stringify({
      role: "Staff Engineer",
      company: "Acme",
      url: "https://example.com/job",
      method: "Lever",
      fit: "High",
      resume: "resume.pdf",
      confirmation: "sent",
      fields: [{ label: "Email", value: "a@b.c" }, { label: "ignored" }],
    }),
  )
  assert.equal(entry?.company, "Acme")
  assert.equal(entry?.method, "Lever")
  assert.equal(entry?.fit, "High")
  assert.deepEqual(entry?.fields, [{ label: "Email", value: "a@b.c" }])
  assert.equal(parseAppliedEntry('{"role":"x"}'), null)
  assert.equal(parseAppliedEntry("not json"), null)
})

test("formatAppliedMarkdown records a manual submission", () => {
  const markdown = formatAppliedMarkdown(
    {
      role: "Staff Engineer",
      company: "Acme",
      url: "https://example.com/job",
      resume: "resume.pdf",
      source: "user",
      status: "submitted (manual)",
      note: "User submitted in the browser",
      confirmation: "User reported manual submission on 2026-11-12",
    },
    "2026-11-13",
  )
  assert.ok(markdown.includes("- Source: user"))
  assert.ok(markdown.includes("- Status: submitted (manual)"))
  assert.ok(markdown.includes("- Note: User submitted in the browser"))
})

test("upsertApplicationIndexRow appends and replaces by folder", () => {
  const header = "# Applications\n\n| Date | Folder |\n| --- | --- |\n"
  const first = "| 2026-11-12 | jobs/acme |\n"
  const second = "| 2026-11-13 | jobs/acme |\n"
  const appended = upsertApplicationIndexRow(header, first, "jobs/acme")
  assert.ok(appended.endsWith(first))
  const replaced = upsertApplicationIndexRow(appended, second, "jobs/acme")
  assert.ok(replaced.includes(second.trim()))
  assert.ok(!replaced.includes("2026-11-12"))
  assert.equal(replaced.match(/jobs\/acme/g)?.length, 1)
})

test("formatApplicationIndexRow builds the applications.md row", () => {
  const row = formatApplicationIndexRow(
    {
      role: "Staff Engineer",
      company: "Acme | Labs",
      url: "https://example.com/job",
      method: "Lever",
      fit: "Medium",
      resume: "resume.pdf",
      confirmation: "sent",
    },
    "jobs/acme",
    "2026-11-13",
  )
  assert.equal(
    row,
    "| 2026-11-13 | Acme \\| Labs | Staff Engineer | Medium | Lever | submitted | sent | https://example.com/job | jobs/acme |\n",
  )
})

test("parseAutomationConfig round-trips the Markdown config", () => {
  const source = `# Automation

- enabled: true
- times: "08:30,18:30"
- interval: daily
- model: "opencode-go/deepseek-v4.1-flash#max"
- standingApproval: true
- maxApplicationsPerRun: 0
- includeBacklog: true
- includeJobSearch: true
- includeFeedSearch: false
- searchWindowHours: 24
- notify: true
- openReport: false
- maxRuntimeMinutes: 45
`
  const config = parseAutomationConfig(source)
  assert.equal(config.enabled, true)
  assert.deepEqual(config.times, ["08:30", "18:30"])
  assert.equal(config.interval, "daily")
  assert.equal(config.model, "opencode-go/deepseek-v4.1-flash#max")
  assert.equal(config.maxApplicationsPerRun, 0)
  assert.equal(config.includeFeedSearch, false)
  assert.equal(config.searchWindowHours, 24)
  assert.equal(config.openReport, false)
  assert.equal(config.maxRuntimeMinutes, 45)
  assert.deepEqual(parseAutomationConfig(formatAutomationConfig(config)), config)
})

test("parseAutomationConfig accepts the legacy single time", () => {
  const config = parseAutomationConfig(`# Automation

- time: "11:30"
- interval: daily
`)
  assert.deepEqual(config.times, ["11:30"])
  assert.deepEqual(parseTimes("11:30, 18:30"), ["11:30", "18:30"])
})

test("validateAutomationConfig rejects bad times, intervals and models", () => {
  assert.deepEqual(validateAutomationConfig(DEFAULT_AUTOMATION), [])
  assert.deepEqual(
    validateAutomationConfig({
      ...DEFAULT_AUTOMATION,
      model: "opencode-go/deepseek-v4.1-flash#max",
    }),
    [],
  )
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, times: ["9:00"] }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, times: [] }).length > 0)
  assert.ok(
    validateAutomationConfig({ ...DEFAULT_AUTOMATION, times: ["09:00", "09:00"] }).length > 0,
  )
  assert.ok(
    validateAutomationConfig({
      ...DEFAULT_AUTOMATION,
      times: ["09:00", "18:00"],
      interval: "every 12h",
    }).length > 0,
  )
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, interval: "every 25h" }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, model: "not-a-model" }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, maxRuntimeMinutes: 1 }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, maxApplicationsPerRun: -1 }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, searchWindowHours: 0 }).length > 0)
  assert.ok(validateAutomationConfig({ ...DEFAULT_AUTOMATION, searchWindowHours: 200 }).length > 0)
})

test("nextRunAt handles daily, multiple times and every-N-hours schedules", () => {
  const base = new Date(2026, 10, 16, 8, 0, 0)
  const daily = nextRunAt({ ...DEFAULT_AUTOMATION, enabled: true, times: ["09:00"] }, base)
  assert.equal(daily?.getFullYear(), 2026)
  assert.equal(daily?.getMonth(), 10)
  assert.equal(daily?.getDate(), 16)
  assert.equal(daily?.getHours(), 9)

  const nextDay = nextRunAt({ ...DEFAULT_AUTOMATION, enabled: true, times: ["07:00"] }, base)
  assert.equal(nextDay?.getDate(), 17)
  assert.equal(nextDay?.getHours(), 7)

  const twoTimes = { ...DEFAULT_AUTOMATION, enabled: true, times: ["11:30", "18:30"] }
  assert.equal(nextRunAt(twoTimes, base)?.getHours(), 11)
  assert.equal(nextRunAt(twoTimes, new Date(2026, 10, 16, 12, 0, 0))?.getHours(), 18)
  const tomorrow = nextRunAt(twoTimes, new Date(2026, 10, 16, 19, 0, 0))
  assert.equal(tomorrow?.getDate(), 17)
  assert.equal(tomorrow?.getHours(), 11)

  const every = nextRunAt(
    { ...DEFAULT_AUTOMATION, enabled: true, interval: "every 12h" },
    base,
    base,
  )
  assert.equal(every?.getTime(), base.getTime() + 12 * 60 * 60 * 1000)
})

test("scheduler builders cover launchd, systemd, cron and Windows", () => {
  const spec = {
    times: ["09:00", "18:30"],
    interval: "daily",
    wrapperPath: "/data/bin/scheduled-search.sh",
    logsDir: "/data/logs",
    label: "com.test.search",
    taskName: "test-search",
  }
  const plist = buildLaunchdPlist(spec)
  assert.ok(plist.includes("<key>StartCalendarInterval</key>"))
  assert.ok(plist.includes("<integer>9</integer>"))
  assert.ok(plist.includes("<integer>18</integer>"))
  assert.ok(plist.includes("/data/bin/scheduled-search.sh"))
  const intervalPlist = buildLaunchdPlist({ ...spec, interval: "every 12h" })
  assert.ok(intervalPlist.includes("<key>StartInterval</key>"))
  assert.ok(intervalPlist.includes(String(12 * 60 * 60)))

  const timer = buildSystemdTimer(spec)
  assert.ok(timer.includes("OnCalendar=*-*-* 09:00:00"))
  assert.ok(timer.includes("OnCalendar=*-*-* 18:30:00"))
  assert.ok(buildSystemdTimer({ ...spec, interval: "every 12h" }).includes("OnUnitActiveSec=12h"))
  assert.deepEqual(
    buildCronLines(spec).map((line) => line.split(" ").slice(0, 5).join(" ")),
    ["0 9 * * *", "30 18 * * *"],
  )
  assert.deepEqual(
    buildCronLines({ ...spec, interval: "every 12h" }).map((line) => line.split(" ").slice(0, 5).join(" ")),
    ["0 */12 * * *"],
  )

  assert.equal(windowsTaskName(spec, 0), "test-search-1")
  assert.equal(windowsTaskName(spec, 1), "test-search-2")
  assert.equal(windowsTaskName({ ...spec, times: ["09:00"] }, 0), "test-search")
  const win = buildWindowsTaskArgs(spec, "09:00", windowsTaskName(spec, 0))
  assert.ok(win.includes("/SC") && win.includes("DAILY") && win.includes("09:00"))
  assert.ok(win.includes("test-search-1"))
  const winInterval = buildWindowsTaskArgs({ ...spec, interval: "every 12h" }, "09:00", "test-search")
  assert.ok(winInterval.includes("HOURLY") && winInterval.includes("12"))

  assert.equal(intervalHours("every 12h"), 12)
  assert.equal(intervalHours("daily"), null)
  assert.equal(detectScheduler("darwin"), "launchd")
  assert.equal(detectScheduler("linux"), "systemd")
  assert.equal(detectScheduler("win32"), "task-scheduler")
})

test("notification and wrapper builders are platform-specific", () => {
  const mac = buildNotificationCommand("darwin", "Title", "Body")
  assert.equal(mac.command, "osascript")
  assert.ok(mac.args[1]?.includes("display notification"))
  const linux = buildNotificationCommand("linux", "Title", "Body")
  assert.equal(linux.command, "notify-send")
  assert.deepEqual(linux.args, ["Title", "Body"])
  const win = buildNotificationCommand("win32", "Title", "Body")
  assert.equal(win.command, "powershell")

  const wrapper = buildPosixWrapper({
    runtimeDir: "/runtime",
    dataDir: "/data",
    nodePath: "/node",
    tsxCliPath: "/runtime/node_modules/tsx/dist/cli.mjs",
    runnerPath: "/runtime/scripts/scheduled-search.ts",
    opencodePath: "/opt/homebrew/bin/opencode",
    pathEnv: "/opt/homebrew/bin:/usr/bin:/bin",
  })
  assert.ok(wrapper.includes("cd '/runtime'"))
  assert.ok(wrapper.includes("exec '/node'"))
  assert.ok(wrapper.includes("PATH='/opt/homebrew/bin:/usr/bin:/bin'"))
  assert.ok(wrapper.includes("JOBSEARCH_OPENCODE_BIN='/opt/homebrew/bin/opencode'"))
  assert.ok(wrapper.includes("JOBSEARCH_HOME='/data'"))
  assert.ok(wrapper.includes("/runtime/logs/scheduler.log"))
  assert.ok(!wrapper.includes("/repo"))
  const windows = buildWindowsWrapper({
    runtimeDir: "C:\\runtime",
    dataDir: "C:\\data",
    nodePath: "C:\\node.exe",
    tsxCliPath: "C:\\runtime\\node_modules\\tsx\\dist\\cli.mjs",
    runnerPath: "C:\\runtime\\scripts\\scheduled-search.ts",
    opencodePath: "C:\\tools\\opencode\\opencode.cmd",
    pathEnv: "C:\\tools\\opencode;C:\\Windows\\System32",
  })
  assert.ok(windows.includes("@echo off"))
  assert.ok(windows.includes("cd /d \"C:\\runtime\""))
  assert.ok(windows.includes("JOBSEARCH_OPENCODE_BIN"))
  assert.ok(windows.includes("JOBSEARCH_HOME"))
  assert.ok(windows.includes("set \"PATH="))
})

test("automationReady lists missing user data", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-automation-"))
  try {
    mkdirSync(path.join(dir, "resume"))
    for (const file of ["profile.md", "preferences.md", "application-data.md", "language.md"]) {
      writeFileSync(path.join(dir, file), "x")
    }
    writeFileSync(path.join(dir, "resume", "base.md"), "x")
    assert.deepEqual(await automationReady(dir), [])
    rmSync(path.join(dir, "resume", "base.md"))
    assert.deepEqual(await automationReady(dir), ["resume/base.md"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("buildScheduledPrompt includes the user data and pipeline", () => {
  const prompt = buildScheduledPrompt("/data", { ...DEFAULT_AUTOMATION, enabled: true })
  assert.ok(prompt.includes("/data/automation.md"))
  assert.ok(prompt.includes("profile.md"))
  assert.ok(prompt.includes("preferences.md"))
  assert.ok(prompt.includes("reports/"))
  assert.ok(prompt.includes("pending-search.json"))
  assert.ok(prompt.includes("search.lock"))
  assert.ok(prompt.includes("No application cap"))
  assert.ok(prompt.includes("48-hour job search"))
  assert.ok(
    buildScheduledPrompt("/data", {
      ...DEFAULT_AUTOMATION,
      enabled: true,
      searchWindowHours: 24,
    }).includes("24-hour job search"),
  )
  assert.ok(prompt.includes("mailto"))
  assert.ok(prompt.includes("Needs you"))
})

test("findOpencodeOnPath finds an executable on POSIX", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-opencode-"))
  try {
    const binary = path.join(dir, "opencode")
    writeFileSync(binary, "#!/bin/sh\nexit 0\n")
    chmodSync(binary, 0o755)
    const found = findOpencodeOnPath({ platform: "darwin", env: { PATH: dir }, home: dir })
    assert.equal(found, binary)
    assert.equal(resolveOpencodePath({ platform: "darwin", env: { PATH: dir }, home: dir }), binary)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("resolveOpencodePath falls back to known install locations", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-opencode-home-"))
  try {
    const bin = path.join(dir, ".opencode", "bin")
    mkdirSync(bin, { recursive: true })
    const binary = path.join(bin, "opencode")
    writeFileSync(binary, "#!/bin/sh\nexit 0\n")
    chmodSync(binary, 0o755)
    assert.equal(
      resolveOpencodePath({ platform: "linux", env: { PATH: "" }, home: dir }),
      binary,
    )
    assert.equal(
      resolveOpencodePath({ platform: "darwin", env: { PATH: "" }, home: dir, override: binary }),
      binary,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("findNodePath finds node on PATH", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-node-"))
  try {
    const binary = path.join(dir, "node")
    writeFileSync(binary, "#!/bin/sh\nexit 0\n")
    chmodSync(binary, 0o755)
    assert.equal(findNodePath({ platform: "darwin", env: { PATH: dir }, home: dir }), binary)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("knownOpencodePaths covers Windows and Unix install methods", () => {
  const win = knownOpencodePaths({
    platform: "win32",
    env: {
      LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      APPDATA: "C:\\Users\\test\\AppData\\Roaming",
      ProgramFiles: "C:\\Program Files",
    },
    home: "C:\\Users\\test",
  })
  assert.ok(win.some((item) => item.endsWith("opencode.exe")))
  assert.ok(win.some((item) => item.endsWith("opencode.cmd")))
  assert.ok(win.some((item) => item.includes("npm")))

  const unix = knownOpencodePaths({ platform: "darwin", env: {}, home: "/Users/test" })
  assert.ok(unix.includes("/opt/homebrew/bin/opencode"))
  assert.ok(unix.includes("/usr/local/bin/opencode"))
  assert.ok(unix.some((item) => item.includes(".opencode/bin/opencode")))
})

test("resolveRuntimeDir uses the platform application-data directory", () => {
  assert.equal(
    resolveRuntimeDir({ platform: "darwin", env: {}, home: "/Users/test" }),
    "/Users/test/Library/Application Support/automate-job-search/runtime",
  )
  assert.equal(
    resolveRuntimeDir({ platform: "linux", env: {}, home: "/home/test" }),
    "/home/test/.local/share/automate-job-search/runtime",
  )
  assert.equal(
    resolveRuntimeDir({
      platform: "linux",
      env: { XDG_DATA_HOME: "/data" },
      home: "/home/test",
    }),
    "/data/automate-job-search/runtime",
  )
  assert.equal(
    resolveRuntimeDir({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      home: "C:\\Users\\test",
    }),
    "C:\\Users\\test\\AppData\\Local\\automate-job-search\\runtime",
  )
  assert.equal(
    resolveRuntimeDir({
      platform: "darwin",
      env: { JOBSEARCH_RUNTIME: "/custom/runtime" },
      home: "/Users/test",
    }),
    "/custom/runtime",
  )
})

test("protectedPath flags macOS and Windows protected folders only", () => {
  const mac = { platform: "darwin" as const, env: {}, home: "/Users/test" }
  assert.equal(protectedPath("/Users/test/Documents/jobsearch", mac)?.label, "~/Documents")
  assert.equal(protectedPath("/Users/test/Desktop/jobsearch", mac)?.label, "~/Desktop")
  assert.equal(protectedPath("/Users/test/Downloads/jobsearch", mac)?.label, "~/Downloads")
  assert.equal(
    protectedPath("/Users/test/Library/Mobile Documents/com~apple~CloudDocs/jobsearch", mac)?.label,
    "iCloud Drive",
  )
  assert.equal(protectedPath("/Volumes/Backup/jobsearch", mac)?.label, "an external volume")
  assert.equal(protectedPath("/Users/test/.jobsearch", mac), null)

  const win = {
    platform: "win32" as const,
    env: { OneDrive: "C:\\Users\\test\\OneDrive" },
    home: "C:\\Users\\test",
  }
  assert.equal(protectedPath("C:\\Users\\test\\Documents\\jobsearch", win)?.label, "%USERPROFILE%\\Documents")
  assert.equal(protectedPath("C:\\Users\\test\\OneDrive\\jobsearch", win)?.label, "%OneDrive%")
  assert.equal(protectedPath("C:\\jobsearch", win), null)

  assert.equal(
    protectedPath("/home/test/Documents/jobsearch", {
      platform: "linux",
      env: {},
      home: "/home/test",
    }),
    null,
  )
})

test("isInsidePath compares complete path segments", () => {
  assert.equal(isInsidePath("/Users/test/Documents/a", "/Users/test/Documents", "darwin"), true)
  assert.equal(isInsidePath("/Users/test/Documents", "/Users/test/Documents", "darwin"), true)
  assert.equal(isInsidePath("/Users/test/Documents-old/a", "/Users/test/Documents", "darwin"), false)
  assert.equal(isInsidePath("/data/x", "/data", "linux"), true)
  assert.equal(isInsidePath("/database/x", "/data", "linux"), false)
  assert.equal(isInsidePath("C:\\Users\\Test\\Documents\\a", "c:\\users\\test\\documents", "win32"), true)
})

test("safePathEnv drops protected entries", () => {
  assert.equal(
    safePathEnv("/opt/homebrew/bin:/Users/test/Documents/bin:/usr/bin", {
      platform: "darwin",
      env: {},
      home: "/Users/test",
    }),
    "/opt/homebrew/bin:/usr/bin",
  )
  assert.equal(
    safePathEnv("C:\\tools;C:\\Users\\test\\Documents\\bin;C:\\Windows", {
      platform: "win32",
      env: {},
      home: "C:\\Users\\test",
    }),
    "C:\\tools;C:\\Windows",
  )
})

test("playwrightProfileDir shares the project's browser profile", () => {
  const expected = createHash("sha256")
    .update("/Users/test/project")
    .digest("hex")
    .slice(0, 7)
  assert.equal(
    playwrightProfileDir("/Users/test/project", {
      platform: "darwin",
      env: {},
      home: "/Users/test",
    }),
    `/Users/test/Library/Caches/ms-playwright-mcp/mcp-chrome-${expected}`,
  )
  assert.equal(
    playwrightProfileDir("/home/test/project", {
      platform: "linux",
      env: { XDG_CACHE_HOME: "/cache" },
      home: "/home/test",
    }),
    `/cache/ms-playwright-mcp/mcp-chrome-${createHash("sha256")
      .update("/home/test/project")
      .digest("hex")
      .slice(0, 7)}`,
  )
})

test("runtimeBrowserProfileDir seeds a dedicated profile without lock files", async () => {
  assert.equal(
    runtimeBrowserProfileDir("/Users/test/automate-job-search/runtime"),
    "/Users/test/automate-job-search/browser-profile",
  )
  const source = mkdtempSync(path.join(os.tmpdir(), "ajs-profile-src-"))
  const targetParent = mkdtempSync(path.join(os.tmpdir(), "ajs-profile-dst-"))
  try {
    mkdirSync(path.join(source, "Default"), { recursive: true })
    writeFileSync(path.join(source, "Default", "Cookies"), "cookie")
    writeFileSync(path.join(source, "SingletonLock"), "lock")
    const target = path.join(targetParent, "browser-profile")
    assert.equal(await seedBrowserProfile(source, target), "copied")
    assert.equal(readFileSync(path.join(target, "Default", "Cookies"), "utf8"), "cookie")
    assert.throws(() => readFileSync(path.join(target, "SingletonLock")))
    assert.equal(await seedBrowserProfile(source, target), "kept")
    assert.equal(
      await seedBrowserProfile(path.join(source, "missing"), path.join(targetParent, "other")),
      "missing",
    )
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(targetParent, { recursive: true, force: true })
  }
})

test("buildRuntimeOpencodeConfig adds a stable browser profile", () => {
  const source = `{
  "mcp": {
    "servers": {
      "playwright": {
        "command": ["npx", "@playwright/mcp@latest", "--browser", "chrome",
          "--allow-unrestricted-file-access"],
      },
    },
  },
}
`
  const result = buildRuntimeOpencodeConfig(source, "/Users/test/profile")
  assert.equal(result.injected, true)
  assert.ok(result.content.includes('"--user-data-dir"'))
  assert.ok(result.content.includes('"/Users/test/profile"'))
  assert.ok(result.content.includes("--allow-unrestricted-file-access"))
  const already = buildRuntimeOpencodeConfig(result.content, "/other")
  assert.equal(already.injected, true)
  assert.ok(already.content.includes("/Users/test/profile"))
  assert.equal(buildRuntimeOpencodeConfig("{}", "/profile").injected, false)
})

test("parseRuntimeManifest and compareRuntime detect stale copies", () => {
  const manifest = {
    schema: 1,
    version: "0.9.0",
    source: "/project",
    sourceCommit: "abc123",
    sourceDirty: false,
    syncedAt: "2026-11-17T00:00:00.000Z",
    lockHash: "hash",
  }
  assert.deepEqual(parseRuntimeManifest(JSON.stringify(manifest)), manifest)
  assert.equal(parseRuntimeManifest('{"schema":1}'), null)
  assert.equal(parseRuntimeManifest("not json"), null)

  const expected = {
    source: "/project",
    version: "0.9.0",
    sourceCommit: "abc123",
    sourceDirty: false,
  }
  assert.equal(compareRuntime(manifest, expected).state, "current")
  assert.equal(compareRuntime(null, expected).state, "missing")
  assert.equal(
    compareRuntime({ ...manifest, sourceCommit: "old" }, expected).state,
    "stale",
  )
  assert.equal(
    compareRuntime({ ...manifest, source: "/other" }, expected).state,
    "stale",
  )
})

test("syncRuntime copies code, keeps dependencies and skips unchanged ones", async () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "ajs-runtime-repo-"))
  const runtime = mkdtempSync(path.join(os.tmpdir(), "ajs-runtime-out-"))
  try {
    mkdirSync(path.join(repo, ".opencode", "agents"), { recursive: true })
    mkdirSync(path.join(repo, "lib"), { recursive: true })
    mkdirSync(path.join(repo, "scripts"), { recursive: true })
    mkdirSync(path.join(repo, "node_modules", "tsx", "dist"), { recursive: true })
    writeFileSync(path.join(repo, ".opencode", "agents", "coach.md"), "coach")
    writeFileSync(path.join(repo, "lib", "runtime.ts"), "runtime")
    writeFileSync(path.join(repo, "scripts", "scheduled-search.ts"), "runner")
    writeFileSync(path.join(repo, "node_modules", "tsx", "dist", "cli.mjs"), "tsx")
    writeFileSync(path.join(repo, "package.json"), '{"version":"0.9.0"}')
    writeFileSync(path.join(repo, "package-lock.json"), '{"lock":1}')
    writeFileSync(path.join(repo, "tsconfig.json"), "{}")
    writeFileSync(path.join(repo, "AGENTS.md"), "agents")
    writeFileSync(path.join(repo, "SPEC.md"), "spec")
    writeFileSync(path.join(repo, "opencode.jsonc"), '{"mcp":{}}')

    const first = await syncRuntime({
      repoPath: repo,
      runtimePath: runtime,
      opencodeConfig: '{"runtime":true}',
    })
    assert.equal(first.dependenciesCopied, true)
    assert.equal(readFileSync(path.join(runtime, "lib", "runtime.ts"), "utf8"), "runtime")
    assert.equal(
      readFileSync(path.join(runtime, "scripts", "scheduled-search.ts"), "utf8"),
      "runner",
    )
    assert.equal(readFileSync(path.join(runtime, "opencode.jsonc"), "utf8"), '{"runtime":true}')
    assert.equal(first.manifest.version, "0.9.0")

    const second = await syncRuntime({
      repoPath: repo,
      runtimePath: runtime,
      opencodeConfig: '{"runtime":true}',
    })
    assert.equal(second.dependenciesCopied, false)

    writeFileSync(path.join(repo, "package-lock.json"), '{"lock":2}')
    const third = await syncRuntime({
      repoPath: repo,
      runtimePath: runtime,
      opencodeConfig: '{"runtime":true}',
    })
    assert.equal(third.dependenciesCopied, true)
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(runtime, { recursive: true, force: true })
  }
})

test("migrateDataDirectory copies data, leaves the source and drops scheduler artifacts", async () => {
  const source = mkdtempSync(path.join(os.tmpdir(), "ajs-migrate-src-"))
  const target = mkdtempSync(path.join(os.tmpdir(), "ajs-migrate-dst-"))
  try {
    mkdirSync(path.join(source, "resume"), { recursive: true })
    mkdirSync(path.join(source, "bin"), { recursive: true })
    mkdirSync(path.join(source, "state"), { recursive: true })
    mkdirSync(path.join(source, "logs"), { recursive: true })
    writeFileSync(path.join(source, "profile.md"), "profile")
    writeFileSync(path.join(source, "resume", "base.md"), "resume")
    writeFileSync(path.join(source, "bin", "scheduled-search.sh"), "old")
    writeFileSync(path.join(source, "state", "search.lock"), "lock")
    writeFileSync(path.join(source, "logs", "scheduler.log"), "old log")

    const result = await migrateDataDirectory(source, target)
    assert.equal(result.files, 2)
    assert.equal(readFileSync(path.join(target, "profile.md"), "utf8"), "profile")
    assert.equal(readFileSync(path.join(target, "resume", "base.md"), "utf8"), "resume")
    assert.equal(readFileSync(path.join(source, "profile.md"), "utf8"), "profile")
    assert.throws(() => readFileSync(path.join(target, "bin", "scheduled-search.sh")))
    assert.throws(() => readFileSync(path.join(target, "state", "search.lock")))
    assert.throws(() => readFileSync(path.join(target, "logs", "scheduler.log")))

    mkdirSync(path.join(target, "extra"))
    writeFileSync(path.join(target, "extra", "x"), "x")
    await assert.rejects(() => migrateDataDirectory(source, target))
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(target, { recursive: true, force: true })
  }
})

test("isTransportFailure recognizes connection resets and timeouts", () => {
  assert.equal(
    isTransportFailure("Transport: ECONNRESET: The socket connection was closed unexpectedly."),
    true,
  )
  assert.equal(isTransportFailure("", new Error("fetch failed")), true)
  assert.equal(isTransportFailure("Error: ETIMEDOUT"), true)
  assert.equal(isTransportFailure("Error: model not found"), false)
  assert.equal(isTransportFailure(""), false)
})

test("canRetryRun requires a failure, no submission and half the budget", () => {
  const base = {
    status: 1,
    elapsedMs: 10 * 60_000,
    maxRuntimeMinutes: 60,
    applicationsWritten: false,
  }
  assert.equal(canRetryRun(base), true)
  assert.equal(canRetryRun({ ...base, status: 0 }), false)
  assert.equal(canRetryRun({ ...base, applicationsWritten: true }), false)
  assert.equal(canRetryRun({ ...base, elapsedMs: 31 * 60_000 }), false)
})

test("applicationsWrittenSince detects applied.md and applications.md", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-retry-"))
  try {
    mkdirSync(path.join(dir, "jobs", "acme"), { recursive: true })
    writeFileSync(path.join(dir, "jobs", "acme", "applied.md"), "x")
    const now = Date.now()
    assert.equal(await applicationsWrittenSince(dir, now - 10_000), true)
    assert.equal(await applicationsWrittenSince(dir, now + 10_000), false)
    writeFileSync(path.join(dir, "applications.md"), "row")
    assert.equal(await applicationsWrittenSince(dir, now - 10_000), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("resolveOpencodeDefaultModel reads the OpenCode config", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-model-"))
  try {
    mkdirSync(path.join(dir, "opencode"), { recursive: true })
    const jsonc = path.join(dir, "opencode", "opencode.jsonc")
    writeFileSync(
      jsonc,
      `{
  // OpenCode default
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/deepseek-v4.1-flash#max",
}
`,
    )
    const options = { env: { XDG_CONFIG_HOME: dir }, home: dir }
    assert.equal(
      resolveOpencodeDefaultModel(options),
      "opencode-go/deepseek-v4.1-flash#max",
    )
    writeFileSync(
      jsonc,
      `{
  "model": { "providerID": "opencode-go", "model": "deepseek-v4.1-flash" }
}`,
    )
    assert.equal(resolveOpencodeDefaultModel(options), "opencode-go/deepseek-v4.1-flash")
    writeFileSync(jsonc, '{ "$schema": "https://opencode.ai/config.json" }')
    assert.equal(resolveOpencodeDefaultModel(options), null)
    writeFileSync(
      path.join(dir, "opencode", "opencode.json"),
      '{"model":"openai/gpt-6.1-sol"}',
    )
    assert.equal(resolveOpencodeDefaultModel(options), "openai/gpt-6.1-sol")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("parseAppliedMarkdown reads the date and status", () => {
  const source = `# Application — React Developer at Acme

- Date: 2026-10-22
- Status: submitted (manual)
`
  const record = parseAppliedMarkdown(source)
  assert.equal(record?.date, "2026-10-22")
  assert.equal(record?.status, "submitted (manual)")
  assert.equal(record?.role, "React Developer")
  assert.equal(record?.company, "Acme")
  assert.equal(parseAppliedMarkdown("# no fields"), null)
})

test("cleanupExpiredData removes old submissions and feed leads", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-cleanup-"))
  const now = new Date(2026, 10, 21) // 2026-11-21
  try {
    const jobs = path.join(dir, "jobs")
    const feed = path.join(dir, "feed")
    const state = path.join(dir, "state")
    mkdirSync(jobs, { recursive: true })
    mkdirSync(feed, { recursive: true })
    mkdirSync(state, { recursive: true })

    function addJob(folder: string, date: string, status: string): void {
      mkdirSync(path.join(jobs, folder), { recursive: true })
      writeFileSync(
        path.join(jobs, folder, "applied.md"),
        `# Application — Role at Acme\n\n- Date: ${date}\n- Job URL: https://example.com/job\n- Method: LinkedIn Easy Apply\n- Fit: Medium\n- Status: ${status}\n- Confirmation: "sent"\n- Resume: resume.pdf\n`,
      )
      writeFileSync(path.join(jobs, folder, "resume.pdf"), "pdf")
    }

    addJob("old", "2026-10-22", "submitted")
    addJob("manual", "2026-10-22", "submitted (manual)")
    addJob("recent", "2026-11-01", "submitted")
    addJob("pending", "2026-10-01", "submitted")
    addJob("draft", "2026-10-01", "draft")
    mkdirSync(path.join(jobs, "unparsable"), { recursive: true })
    writeFileSync(
      path.join(jobs, "unparsable", "applied.md"),
      "# Application\n\n- Date: 2026-10-01\n- Status: submitted\n",
    )
    mkdirSync(path.join(jobs, "no-applied"))
    writeFileSync(path.join(jobs, "no-applied", "posting.md"), "posting")

    writeFileSync(path.join(dir, "applications.md"), "| log |\n")
    writeFileSync(
      path.join(state, "pending-search.json"),
      JSON.stringify({
        generatedAt: "2026-11-21T00:00:00.000Z",
        items: [
          {
            jobFolder: "jobs/pending",
            url: "",
            company: "",
            role: "",
            stage: "login",
            action: "x",
          },
          {
            jobFolder: "feed/2026-10-01-pending-react.md",
            url: "",
            company: "",
            role: "",
            stage: "lead",
            action: "x",
          },
        ],
      }),
    )

    writeFileSync(
      path.join(feed, "2026-10-01-acme-react.md"),
      "# Feed lead\n\n- Date: 2026-10-01\n- Fit: Medium\n",
    )
    writeFileSync(path.join(feed, "2026-10-01-acme-react-email.md"), "draft")
    writeFileSync(
      path.join(feed, "2026-11-10-recent-react.md"),
      "# Feed lead\n\n- Date: 2026-11-10\n",
    )
    writeFileSync(
      path.join(feed, "2026-10-01-pending-react.md"),
      "# Feed lead\n\n- Date: 2026-10-01\n",
    )

    const dry = await cleanupExpiredData(dir, { now, days: 30 })
    assert.deepEqual(
      dry.candidates.map((item) => item.path).sort(),
      [
        "feed/2026-10-01-acme-react.md",
        "jobs/manual",
        "jobs/old",
        "jobs/unparsable",
      ],
    )
    assert.equal(dry.deleted.length, 0)

    const applied = await cleanupExpiredData(dir, { now, days: 30, apply: true })
    assert.equal(applied.deleted.length, 3)
    assert.equal(applied.backfilled.length, 2)
    assert.ok(
      applied.failed.some((item) => item.path === "jobs/unparsable"),
    )
    assert.throws(() => readFileSync(path.join(jobs, "old", "applied.md")))
    assert.throws(() => readFileSync(path.join(jobs, "manual", "resume.pdf")))
    assert.throws(() => readFileSync(path.join(feed, "2026-10-01-acme-react.md")))
    assert.throws(() =>
      readFileSync(path.join(feed, "2026-10-01-acme-react-email.md")),
    )
    assert.ok(
      readFileSync(path.join(jobs, "unparsable", "applied.md"), "utf8").includes(
        "submitted",
      ),
    )
    const index = readFileSync(path.join(dir, "applications.md"), "utf8")
    assert.ok(index.includes("jobs/old"))
    assert.ok(index.includes("jobs/manual"))
    assert.ok(
      readFileSync(path.join(jobs, "recent", "applied.md"), "utf8").includes(
        "2026-11-01",
      ),
    )
    assert.ok(
      readFileSync(path.join(jobs, "pending", "applied.md"), "utf8").includes(
        "2026-10-01",
      ),
    )
    assert.ok(
      readFileSync(path.join(feed, "2026-10-01-pending-react.md"), "utf8").includes(
        "Feed lead",
      ),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("applied index matches normalized URLs and company+role", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-applied-"))
  try {
    writeFileSync(
      path.join(dir, "applications.md"),
      `# Applications

| Date | Company | Role | Fit | Method | Status | Confirmation | Job URL | Folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-19 | INDI Staffing Services | React Senior Developer - Remote Work | High | LinkedIn Easy Apply | submitted | sent | https://www.linkedin.com/jobs/view/4492050725/?trackingId=x | jobs/indi-staffing-services-react-senior-developer-remote-work-2026-11-19 |
| 2026-11-21 | Shapely | Full-Stack Developer | Medium | manual | submitted (manual) | reported | https://careers.getshapely.com/jobs/1 | jobs/shapely-full-stack-developer-2026-11-19 |
`,
    )
    const index = await readAppliedIndex(dir)
    assert.equal(index.rows.length, 2)
    assert.notEqual(
      isApplied(index, { url: "https://www.linkedin.com/jobs/view/4492050725/" }),
      null,
    )
    assert.notEqual(
      isApplied(index, {
        company: "INDI Staffing Services",
        role: "React Senior Developer - Remote Work",
      }),
      null,
    )
    assert.notEqual(
      isApplied(index, { company: "shapely", role: "full stack developer" }),
      null,
    )
    assert.equal(isApplied(index, { company: "Acme", role: "React Developer" }), null)
    assert.notEqual(
      isApplied(index, {
        folder: "jobs/shapely-full-stack-developer-2026-11-19",
      }),
      null,
    )
    assert.equal(
      normalizeAppliedUrl("https://de.linkedin.com/jobs/view/4492050725?trackingId=x"),
      "https://www.linkedin.com/jobs/view/4492050725/",
    )
    assert.equal(companyRoleKey("Acme, Inc.", "React Developer"), "acme inc::react developer")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("backlog excludes applied folders and applications.md rows", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ajs-backlog-"))
  try {
    const jobs = path.join(dir, "jobs")
    for (const name of [
      "applied",
      "rowed",
      "rowed-different-date",
      "new",
      "no-posting",
      "bairesdev-role",
    ]) {
      mkdirSync(path.join(jobs, name), { recursive: true })
    }
    writeFileSync(
      path.join(dir, "preferences.md"),
      "# Job Preferences\n\n- Excluded companies: BairesDev\n",
    )
    writeFileSync(path.join(jobs, "applied", "posting.md"), "posting")
    writeFileSync(path.join(jobs, "bairesdev-role", "posting.md"), "posting")
    writeFileSync(
      path.join(jobs, "rowed-different-date", "posting.md"),
      "# Posting — React Developer at Acme\n",
    )
    writeFileSync(
      path.join(jobs, "applied", "applied.md"),
      "# Application\n\n- Date: 2026-11-20\n- Status: submitted\n",
    )
    writeFileSync(path.join(jobs, "rowed", "posting.md"), "posting")
    writeFileSync(path.join(jobs, "new", "posting.md"), "posting")
    writeFileSync(
      path.join(dir, "applications.md"),
      `# Applications

| Date | Company | Role | Fit | Method | Status | Confirmation | Job URL | Folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-21 | Acme | React Developer | Medium | manual | submitted (manual) | reported | https://example.com/job | jobs/rowed |
`,
    )
    const folders = await listBacklogFolders(dir)
    assert.deepEqual(folders, [path.join(jobs, "new")])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("buildReportHtml renders pending cards and the Markdown body", () => {
  const pending: PendingState = {
    generatedAt: "2026-11-23T00:00:00.000Z",
    items: [
      {
        company: "Acme",
        role: "React Developer",
        url: "https://example.com/job",
        stage: "needs_answer",
        action: "Answer <script>alert(1)</script>",
      },
      {
        company: "Soviant",
        role: "Full Stack",
        url: "mailto:jobs@example.com?subject=Hi",
        stage: "email_draft",
        action: "Send the email",
        jobFolder: "jobs/soviant",
      },
    ],
  }
  const html = buildReportHtml({
    date: "2026-11-23",
    markdown:
      "# Run\n\n## Summary\n\n- ok\n\n## Needs you\n\n1. old\n\n## Skipped\n\n- none\n",
    pending,
    status: "completed",
    model: "opencode-go/deepseek-v4.1-flash",
    reportPath: "/data/reports/2026-11-23.md",
  })
  assert.ok(html.includes("Acme — React Developer"))
  assert.ok(html.includes("Falta una respuesta"))
  assert.ok(html.includes("mailto:jobs@example.com?subject=Hi"))
  assert.ok(html.includes("Enviar email"))
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"))
  assert.ok(!html.includes("<script>alert(1)</script>"))
  assert.ok(html.includes("old"))
  assert.ok(html.includes("<h2>Summary</h2>"))
  assert.ok(html.includes("<h2>Skipped</h2>"))
  assert.ok(html.includes("2026-11-23.md"))
})

test("formatPendingSummary truncates and reports extras", () => {
  const summary = formatPendingSummary(
    {
      generatedAt: "2026-11-23T00:00:00.000Z",
      items: [
        { company: "A", role: "R", url: "", stage: "x", action: "123456789012345" },
        { company: "B", role: "S", url: "", stage: "x", action: "short" },
        { company: "C", role: "T", url: "", stage: "x", action: "more" },
      ],
    },
    { maxItems: 2, maxChars: 10 },
  )
  assert.ok(summary.includes("123456789…"))
  assert.ok(summary.includes("+1 más"))
  assert.ok(!summary.includes("C — T"))
})

test("buildOpenCommand is cross-platform", () => {
  assert.deepEqual(buildOpenCommand("darwin", "/tmp/report.html"), {
    command: "open",
    args: ["/tmp/report.html"],
  })
  assert.deepEqual(buildOpenCommand("linux", "/tmp/report.html"), {
    command: "xdg-open",
    args: ["/tmp/report.html"],
  })
  assert.deepEqual(buildOpenCommand("win32", "C:\\report.html"), {
    command: "cmd",
    args: ["/c", "start", "", "C:\\report.html"],
  })
})
