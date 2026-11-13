import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { parseDataDirConfig, resolveDataDirWithSource } from "../lib/data-dir.ts"
import {
  formatApplicationIndexRow,
  formatAppliedMarkdown,
  parseAppliedEntry,
  upsertApplicationIndexRow,
} from "../lib/apply.ts"
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
