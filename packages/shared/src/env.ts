import { config } from "dotenv";
import { join } from "node:path";
import { repoRoot } from "./paths.js";

export function loadRootEnv(): void {
  config({ path: join(repoRoot, ".env") });
}
