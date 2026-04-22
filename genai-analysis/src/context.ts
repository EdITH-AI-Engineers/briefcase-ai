import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type Framework = {
  path: string;
  content: string;
};

export async function loadFramework(path: string): Promise<Framework> {
  const abs = resolve(process.cwd(), path);
  const raw = await readFile(abs, "utf8");
  const content = raw.trim();
  if (!content) {
    throw new Error(`Framework file at ${abs} is empty.`);
  }
  return { path: abs, content };
}
