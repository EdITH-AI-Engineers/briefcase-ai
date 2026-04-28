import { Type, type Schema } from "@google/genai";

// Pass 3 response shape. The body of the narrative is free-form
// markdown; we wrap it in a minimal JSON object so responseMimeType=
// "application/json" can still enforce retry-safe parsing.
export const NARRATIVE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    student_id: {
      type: Type.STRING,
      description:
        "Must equal the profile's id (and the associated analysis result's student_id) verbatim.",
    },
    narrative_markdown: {
      type: Type.STRING,
      description:
        "The full markdown body of the student report. Exclude the References section — it is appended deterministically by the runner from frameworks/references.md.",
    },
  },
  required: ["student_id", "narrative_markdown"],
  propertyOrdering: ["student_id", "narrative_markdown"],
};
