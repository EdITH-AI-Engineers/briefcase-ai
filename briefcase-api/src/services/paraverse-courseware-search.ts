const PARAVERSE_COURSEWARE_BASE = "https://paraverse.feutech.edu.ph/mflix/course/";

export type CoursewareSearchInput = {
  keywords: string | string[];
  limit?: number;
  includeEncryptedVideoLinks?: boolean;
  fetcher?: typeof fetch;
};

export type CoursewareSearchResult = {
  title: string;
  url: string;
  description?: string;
  thumbnailUrl?: string;
  encryptedVideoLinks?: string[];
};

type CourseCandidate = CoursewareSearchResult & {
  haystack: string;
};

const tagPattern = /<[^>]+>/g;
const whitespacePattern = /\s+/g;
const hrefPattern = /\bhref\s*=\s*(["'])(.*?)\1/gi;
const srcPattern = /\bsrc\s*=\s*(["'])(.*?)\1/gi;
const anchorPattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
const imagePattern = /<img\b[^>]*src\s*=\s*(["'])(.*?)\1[^>]*>/i;
const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/i;

export function paraverseCoursewareUrl(path = ""): string {
  return new URL(path, PARAVERSE_COURSEWARE_BASE).toString();
}

export function paraverseCoursewareSearchUrl(input: { keywords: string | string[] }): string {
  const url = new URL(PARAVERSE_COURSEWARE_BASE);
  const keywords = normalizeKeywords(input.keywords).join(" ");
  if (keywords) url.searchParams.set("search", keywords);
  return url.toString();
}

export async function searchParaverseCourseware(input: CoursewareSearchInput): Promise<CoursewareSearchResult[]> {
  const fetcher = input.fetcher ?? fetch;
  const keywords = normalizeKeywords(input.keywords);
  if (keywords.length === 0) return [];

  const response = await fetcher(paraverseCoursewareSearchUrl({ keywords }));
  if (!response.ok) {
    throw new Error(`Paraverse courseware search failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  const candidates = parseCoursewareIndex(html)
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 6)
    .map((item) => stripHaystack(item.candidate));

  if (!input.includeEncryptedVideoLinks) return candidates;

  return Promise.all(candidates.map(async (course) => ({
    ...course,
    encryptedVideoLinks: await fetchEncryptedVideoLinks(course.url, fetcher),
  })));
}

export function parseCoursewareIndex(html: string): CourseCandidate[] {
  const courses = new Map<string, CourseCandidate>();
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[2]);
    const title = cleanText(match[3]);
    if (!title) continue;

    const url = toAbsoluteCoursewareUrl(href);
    if (!url || !isCourseUrl(url)) continue;

    const existing = courses.get(url);
    if (existing && existing.title.length >= title.length) continue;

    const block = nearbyHtmlBlock(html, match.index);
    const description = cleanText(paragraphPattern.exec(block)?.[1] ?? "");
    const thumbnailUrl = toAbsoluteCoursewareUrl(imagePattern.exec(block)?.[2] ?? "");
    courses.set(url, {
      title,
      url,
      ...(description ? { description } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      haystack: cleanText(`${title} ${description} ${block}`),
    });
  }

  return [...courses.values()];
}

export function parseEncryptedVideoLinks(html: string, courseUrl = PARAVERSE_COURSEWARE_BASE): string[] {
  return unique([
    ...attributeUrls(html, hrefPattern, courseUrl),
    ...attributeUrls(html, srcPattern, courseUrl),
  ]).filter((url) => isLikelyEncryptedVideoUrl(url));
}

async function fetchEncryptedVideoLinks(courseUrl: string, fetcher: typeof fetch): Promise<string[]> {
  const response = await fetcher(courseUrl);
  if (!response.ok) return [];
  return parseEncryptedVideoLinks(await response.text(), courseUrl);
}

function normalizeKeywords(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,\s]+/);
  return unique(raw.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean));
}

function scoreCandidate(candidate: CourseCandidate, keywords: string[]): number {
  const haystack = candidate.haystack.toLowerCase();
  return keywords.reduce((score, keyword) => {
    if (candidate.title.toLowerCase().includes(keyword)) return score + 4;
    if (haystack.includes(keyword)) return score + 1;
    return score;
  }, 0);
}

function stripHaystack(candidate: CourseCandidate): CoursewareSearchResult {
  const { haystack: _haystack, ...result } = candidate;
  return result;
}

function nearbyHtmlBlock(html: string, index: number): string {
  const start = html.lastIndexOf("<div", index);
  const end = html.indexOf("</div>", index);
  if (start === -1 || end === -1) return html.slice(index, index + 800);
  return html.slice(Math.max(0, start), Math.min(html.length, end + 6));
}

function attributeUrls(html: string, pattern: RegExp, baseUrl: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(html))) {
    const url = toAbsoluteCoursewareUrl(decodeHtml(match[2]), baseUrl);
    if (url) urls.push(url);
  }
  return urls;
}

function toAbsoluteCoursewareUrl(value: string, baseUrl = PARAVERSE_COURSEWARE_BASE): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:")) {
    return undefined;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function isCourseUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.origin === "https://paraverse.feutech.edu.ph" && parsed.pathname.startsWith("/mflix/course/");
}

function isLikelyEncryptedVideoUrl(url: string): boolean {
  const parsed = new URL(url);
  if (parsed.origin !== "https://paraverse.feutech.edu.ph") return false;
  const value = `${parsed.pathname}${parsed.search}`.toLowerCase();
  return (
    value.includes("/mflix/") &&
    (value.includes("video") || value.includes("watch") || value.includes("lesson") || value.includes("stream"))
  );
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(tagPattern, " ")).replace(whitespacePattern, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
