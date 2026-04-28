import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type FrameworkDoc = {
  id: string;
  version: string;
  title: string;
  url: string;
  publisher?: string;
  scope?: string;
  note?: string;
  content: string;
};

export type Framework = {
  manifestPath: string;
  bundleVersion: string;
  docs: FrameworkDoc[];
  references: string;
};

type ManifestDoc = {
  id: string;
  version: string;
  title: string;
  file: string;
  url: string;
  publisher?: string;
  scope?: string;
  note?: string;
};

type Manifest = {
  bundleVersion: string;
  bundleDate?: string;
  docs: ManifestDoc[];
  references: string;
};

export async function loadFramework(
  manifestPath: string,
): Promise<Framework> {
  const absManifest = resolve(process.cwd(), manifestPath);
  const manifestRaw = await readFile(absManifest, "utf8");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestRaw) as Manifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse framework manifest at ${absManifest}: ${msg}`);
  }
  if (!manifest.docs?.length) {
    throw new Error(`Framework manifest at ${absManifest} has no docs.`);
  }

  const baseDir = dirname(absManifest);
  const docs: FrameworkDoc[] = [];
  for (const d of manifest.docs) {
    const abs = resolve(baseDir, d.file);
    const content = (await readFile(abs, "utf8")).trim();
    if (!content) {
      throw new Error(`Framework doc ${d.id} at ${abs} is empty.`);
    }
    docs.push({
      id: d.id,
      version: d.version,
      title: d.title,
      url: d.url,
      publisher: d.publisher,
      scope: d.scope,
      note: d.note,
      content,
    });
  }

  const referencesAbs = resolve(baseDir, manifest.references);
  const references = (await readFile(referencesAbs, "utf8")).trim();
  if (!references) {
    throw new Error(`References file at ${referencesAbs} is empty.`);
  }

  return {
    manifestPath: absManifest,
    bundleVersion: manifest.bundleVersion,
    docs,
    references,
  };
}
