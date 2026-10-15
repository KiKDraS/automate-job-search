/**
 * PDF text extraction for resumes — deterministic-first.
 *
 * Uses pdfjs-dist (pure JavaScript, no native dependencies) so the model
 * never needs document support: every resume skill reads the extracted plain
 * text (`resume/base.txt`), and free models without PDF ingestion work fine.
 *
 * Boundaries: text-layer PDFs extract cleanly; scanned or image-only PDFs
 * (and DOCX) have no text layer and fall back to asking the user to paste
 * text — see `.opencode/docs/resume-standards.md`, "Missing data".
 */

export interface ExtractedText {
  text: string
  pages: number
  /** True when the output is too short to be a real resume (likely scanned). */
  looksEmpty: boolean
}

const MIN_MEANINGFUL_CHARS = 200

/** Join per-page text into one document, normalizing whitespace. */
export function joinPages(pages: string[]): string {
  return pages
    .map((page) => page.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim())
    .filter((page) => page !== "")
    .join("\n\n")
}

/** A resume with almost no extractable text is probably a scan. */
export function isLikelyScanned(text: string): boolean {
  return text.replace(/\s+/g, "").length < MIN_MEANINGFUL_CHARS
}

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}

interface PdfPageProxy {
  getTextContent(): Promise<{ items: PdfTextItem[] }>
}

interface PdfDocumentProxy {
  numPages: number
  getPage(page: number): Promise<PdfPageProxy>
}

interface PdfModule {
  getDocument(input: { data: Uint8Array }): { promise: Promise<PdfDocumentProxy> }
}

export async function extractPdfText(file: string): Promise<ExtractedText> {
  const { readFile } = await import("node:fs/promises")
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfModule

  const data = new Uint8Array(await readFile(file))
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index)
    const content = await page.getTextContent()
    let pageText = ""
    for (const item of content.items) {
      if (typeof item.str !== "string") continue
      pageText += item.str
      pageText += item.hasEOL ? "\n" : " "
    }
    pages.push(pageText)
  }
  const text = joinPages(pages)
  return { text, pages: doc.numPages, looksEmpty: isLikelyScanned(text) }
}
