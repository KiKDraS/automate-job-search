import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { parseDataDirConfig, resolveDataDirWithSource } from "../lib/data-dir.ts"
import { formatAppliedMarkdown, parseAppliedEntry } from "../lib/apply.ts"
import { isLikelyScanned, joinPages } from "../lib/resume-text.ts"
import {
  buildJobSearchUrl,
  jobIdFromUrl,
  normalizeJobUrl,
  normalizeUrl,
} from "../lib/linkedin-url.ts"
import {
  duplicateKey,
  filterNew,
  formatHistorySection,
  jobFolderName,
  slugify,
  todayIso,
} from "../lib/jobstore.ts"
import { buildPostingMarkdown, unwrapEvalResult } from "../lib/posting.ts"
import { buildResumeHtml, markdownToHtml } from "../lib/resume-html.ts"

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

test("slugify is filesystem-safe and never empty", () => {
  assert.equal(slugify("Acme Corp. (EU)"), "acme-corp-eu")
  assert.equal(slugify("Anahí Foresi"), "anahi-foresi")
  assert.equal(slugify("!!!"), "untitled")
  assert.ok(slugify("x".repeat(80)).length <= 40)
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

test("parseAppliedEntry accepts valid entries and rejects incomplete ones", () => {
  const entry = parseAppliedEntry(
    JSON.stringify({
      role: "Staff Engineer",
      company: "Acme",
      url: "https://example.com/job",
      resume: "resume.pdf",
      confirmation: "sent",
      fields: [{ label: "Email", value: "a@b.c" }, { label: "ignored" }],
    }),
  )
  assert.equal(entry?.company, "Acme")
  assert.deepEqual(entry?.fields, [{ label: "Email", value: "a@b.c" }])
  assert.equal(parseAppliedEntry('{"role":"x"}'), null)
  assert.equal(parseAppliedEntry("not json"), null)
})
