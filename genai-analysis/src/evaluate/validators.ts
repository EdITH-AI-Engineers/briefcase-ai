import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type FrameworkDocText = {
  id: string;
  content: string;
};

export type FrameworkBundleText = {
  docs: Record<string, string>;
  references: string;
};

// Load the raw markdown content of each framework doc so the
// validator can check clause-existence with plain substring matches.
// This deliberately avoids importing the TypeScript Framework loader
// — the evaluator is meant to work against any run folder whose
// manifest.json points at the frameworks it used.
export async function loadFrameworkTexts(
  manifestPath: string,
): Promise<FrameworkBundleText> {
  const abs = resolve(process.cwd(), manifestPath);
  const manifestRaw = await readFile(abs, "utf8");
  const manifest = JSON.parse(manifestRaw) as {
    docs: { id: string; file: string }[];
    references: string;
  };
  const base = dirname(abs);
  const docs: Record<string, string> = {};
  for (const d of manifest.docs) {
    docs[d.id] = await readFile(resolve(base, d.file), "utf8");
  }
  const references = await readFile(resolve(base, manifest.references), "utf8");
  return { docs, references };
}

// SFIA skill codes live inline as `**<CODE>**` in the doc. Other
// citations use clause IDs that appear verbatim. Slate may be
// referenced but we treat slate citations as out-of-scope for
// validity (the prompt rule says not to cite slate).
export function clauseExistsInDoc(
  docId: string,
  clause: string,
  bundle: FrameworkBundleText,
): boolean {
  const body = bundle.docs[docId];
  if (!body) return false;
  if (docId === "sfia-9") {
    const code = clause.split("-")[0];
    return body.includes(`**${code}**`);
  }
  return body.includes(clause);
}

// Program-appropriate CHED doc for a given program.
// BSCS/BSIT cite ched-25; BSCpE cites ched-87; unknown cites neither
// family preferentially.
export function expectedChedDoc(program: string): string | null {
  if (program === "BSCS" || program === "BSIT") return "ched-25";
  if (program === "BSCpE") return "ched-87";
  return null;
}

// Returns true iff a CHED-family citation matches the program's
// expected CHED doc. Non-CHED citations (cc2020, sfia-9) return true
// (they are program-agnostic).
export function citationMatchesProgram(
  program: string,
  doc: string,
): boolean {
  if (doc !== "ched-25" && doc !== "ched-87") return true;
  const expected = expectedChedDoc(program);
  if (!expected) return true;
  return doc === expected;
}

// Slate competency names, in order, used to verify coverage.
export const SLATE_COMPETENCIES = [
  "Computing Foundations",
  "Systems & Infrastructure",
  "Data & Information Management",
  "Security, Ethics & Professional Responsibility",
  "Professional Communication",
  "Collaboration & Teamwork",
  "Self-Directed Learning & Innovation",
] as const;

export const REQUIRED_NARRATIVE_SECTIONS = [
  "Profile Snapshot",
  "Competency Assessment",
  "Development Trajectory",
  "Outlook & Next Steps",
] as const;

// Parse an inline bracket-citation. Two forms are accepted inside
// one pair of square brackets:
//   [doc:clause]
//   [doc:clause1 clause2 clause3]          <- shorthand: reuse doc
//   [doc1:clause doc2:clause]              <- multiple docs
// Returns a list of { doc, clause } pairs. Tokens without `:` are
// treated as continuation clauses belonging to the most recent doc.
export type ParsedCitation = { doc: string; clause: string };

const BRACKET_RE_SRC = /\[([^\]]+)\]/.source;
// Split inside brackets by whitespace; each token is either
// `doc:clause` (resets the current doc) or a bare clause (continues).
// We also accept `doc:` or `:clause` defensively.
const KNOWN_DOC_RE = /^(ched-25|ched-87|cc2020|sfia-9|slate)$/;

export function extractNarrativeCitations(body: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  const re = new RegExp(BRACKET_RE_SRC, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const content = m[1].trim();
    if (!content) continue;
    let currentDoc: string | null = null;
    for (const raw of content.split(/\s+/)) {
      const token = raw.replace(/[.,;]+$/, ""); // strip trailing punct
      if (!token) continue;
      const colon = token.indexOf(":");
      if (colon > 0) {
        const doc = token.slice(0, colon);
        const clause = token.slice(colon + 1);
        if (!clause) continue;
        currentDoc = doc;
        out.push({ doc, clause });
      } else if (currentDoc && KNOWN_DOC_RE.test(currentDoc)) {
        // Continuation clause under the last-seen doc.
        out.push({ doc: currentDoc, clause: token });
      }
      // else: a bare token with no doc context — skip (not a citation).
    }
  }
  return out;
}

// Extract (sentence, citations-closing-it) pairs from narrative body.
// A sentence ends when a bracket-group is immediately followed by a
// sentence-ending punctuation (`.`, `!`, `?`) or end-of-string. We
// attribute each bracket-group to the sentence text that precedes it
// (up to the previous sentence terminator).
export type TaggedSentence = {
  text: string;
  citations: ParsedCitation[];
};

export function splitSentencesWithTags(body: string): {
  tagged: TaggedSentence[];
  totalSentences: number;
} {
  // Naive sentence splitter: split on `.`/`!`/`?` followed by whitespace
  // or newline. Markdown list items and headings count as sentences too.
  // We deliberately do not try to respect "e.g." — the citation-tag
  // heuristic doesn't require linguistic accuracy.
  const cleaned = body.replace(/\r/g, "");
  const candidates = cleaned
    .split(/(?<=[.!?])\s+|\n{2,}/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

  const tagged: TaggedSentence[] = [];
  for (const s of candidates) {
    // Does this sentence contain at least one bracket-group with a
    // recognizable `doc:clause` part?
    const cites = extractNarrativeCitations(s);
    if (cites.length > 0) tagged.push({ text: s, citations: cites });
  }
  return { tagged, totalSentences: candidates.length };
}

// Strip the "## References" footer that the runner appends to every
// narrative. We want to evaluate only the LLM-generated body.
export function stripReferencesFooter(full: string): string {
  const marker = "\n\n---\n\n## References";
  const idx = full.indexOf(marker);
  return idx === -1 ? full : full.slice(0, idx);
}

// Section-structure check: do the 5 required H2 headings appear in
// order somewhere in the body?
export function sectionsInOrder(body: string): boolean {
  let pos = 0;
  for (const name of REQUIRED_NARRATIVE_SECTIONS) {
    const needle = `## ${name}`;
    const found = body.indexOf(needle, pos);
    if (found === -1) return false;
    pos = found + needle.length;
  }
  return true;
}

// Find the clause text inside a doc to use as the reference string
// for framework-alignment ROUGE-L. Returns the surrounding block
// (bullet or paragraph). Returns null if the clause can't be located.
function bulletAround(body: string, idx: number): string {
  const lineStart = body.lastIndexOf("\n", idx);
  const lineEnd = body.indexOf("\n", idx);
  const line = body.slice(
    lineStart === -1 ? 0 : lineStart + 1,
    lineEnd === -1 ? body.length : lineEnd,
  );
  // SFIA bullets carry a trailing "Canonical: https://..." URL that
  // dominates token overlap against narrative sentences. Strip it so
  // framework-alignment ROUGE-L reflects the skill descriptor only.
  return line.replace(/\s*Canonical:\s*https?:\/\/\S+\s*$/i, "").trim();
}

export function locateClauseText(
  docId: string,
  clause: string,
  bundle: FrameworkBundleText,
): string | null {
  const body = bundle.docs[docId];
  if (!body) return null;
  if (docId === "sfia-9") {
    const code = clause.split("-")[0];
    const needle = `**${code}**`;
    const idx = body.indexOf(needle);
    if (idx === -1) return null;
    return bulletAround(body, idx);
  }
  const idx = body.indexOf(clause);
  if (idx === -1) return null;
  return bulletAround(body, idx);
}
