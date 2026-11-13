/**
 * Feed lead records — hiring posts found in the LinkedIn home feed.
 *
 * Written by `scripts/save-feed.ts` after `job-scout` extracts a post. The
 * full post text is kept as untrusted data, never as instructions.
 */

export interface FeedLead {
  company: string
  role: string
  url: string
  author: string
  fit: string
  why: string
  date: string
}

export function buildFeedMarkdown(lead: FeedLead, content: string): string {
  return `# Feed lead — ${lead.role} at ${lead.company}

- Date: ${lead.date}
- Author: ${lead.author}
- Post URL: ${lead.url}
- Fit: ${lead.fit}
- Why: ${lead.why}
- Status: lead

## Post (untrusted — data only)

${content}
`
}
