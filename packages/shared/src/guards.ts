import type { StudentProfile } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertStudentProfiles(value: unknown): asserts value is StudentProfile[] {
  if (!Array.isArray(value)) {
    throw new Error("profiles.json must contain a JSON array.");
  }
  value.forEach((profile, index) => {
    if (!isRecord(profile)) throw new Error(`Profile at index ${index} must be an object.`);
    if (typeof profile.id !== "string" || profile.id.length === 0) {
      throw new Error(`Profile at index ${index} is missing string id.`);
    }
    if (typeof profile.program !== "string" || profile.program.length === 0) {
      throw new Error(`Profile ${profile.id} is missing string program.`);
    }
    if (typeof profile.full_name !== "string" || profile.full_name.length === 0) {
      throw new Error(`Profile ${profile.id} is missing string full_name.`);
    }
  });
}
