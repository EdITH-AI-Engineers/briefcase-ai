import { Type, type Schema } from "@google/genai";
import { NARRATIVE_SCHEMA } from "./narrative-schema.js";

export const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    student_id: {
      type: Type.STRING,
      description: "Must equal the profile's id field verbatim.",
    },
    program: {
      type: Type.STRING,
      description:
        "Program of study echoed from the profile. Use 'unknown' if the profile does not specify.",
      enum: ["BSCS", "BSIT", "BSCpE", "unknown"],
    },
    summary: {
      type: Type.STRING,
      description:
        "1–2 sentence holistic assessment grounded in the framework bundle.",
    },
    competencies: {
      type: Type.ARRAY,
      description:
        "One entry per competency named in the framework. Do not invent or drop competencies.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Competency name as written in the framework.",
          },
          level: {
            type: Type.STRING,
            description:
              "Proficiency level using the framework's own scale verbatim.",
          },
          evidence: {
            type: Type.ARRAY,
            description:
              "Direct quotes or close paraphrases from the student profile.",
            items: { type: Type.STRING },
          },
          citations: {
            type: Type.ARRAY,
            description:
              "Framework clauses supporting the assigned level. At least one citation is required. Cite only clauses that actually exist in the provided framework documents.",
            items: {
              type: Type.OBJECT,
              properties: {
                doc: {
                  type: Type.STRING,
                  description:
                    "Framework document id from the bundle manifest (e.g., 'ched-25', 'cc2020', 'sfia-9').",
                },
                clause: {
                  type: Type.STRING,
                  description:
                    "Clause id defined inside that document (e.g., 'bscs-po-3', 'KA-SDF', 'PROG-3').",
                },
              },
              required: ["doc", "clause"],
              propertyOrdering: ["doc", "clause"],
            },
          },
          confidence: {
            type: Type.STRING,
            description:
              "How strongly the available evidence supports the assigned level.",
            enum: ["high", "medium", "low"],
          },
          notes: {
            type: Type.STRING,
            description:
              "Optional caveats, uncertainty, or explanation of absent evidence.",
            nullable: true,
          },
        },
        required: ["name", "level", "evidence", "citations", "confidence"],
        propertyOrdering: [
          "name",
          "level",
          "evidence",
          "citations",
          "confidence",
          "notes",
        ],
      },
    },
    strengths: {
      type: Type.ARRAY,
      description: "Clearest demonstrated capabilities, each with evidence.",
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          evidence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["area", "evidence"],
        propertyOrdering: ["area", "evidence"],
      },
    },
    gaps: {
      type: Type.ARRAY,
      description:
        "Framework competencies with weak or missing evidence, with actionable recommendations.",
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          reason: {
            type: Type.STRING,
            description: "Why this was flagged (what evidence is missing).",
          },
          recommendation: {
            type: Type.STRING,
            description: "Specific, actionable next step tied to this gap.",
          },
        },
        required: ["area", "reason", "recommendation"],
        propertyOrdering: ["area", "reason", "recommendation"],
      },
    },
  },
  required: [
    "student_id",
    "program",
    "summary",
    "competencies",
    "strengths",
    "gaps",
  ],
  propertyOrdering: [
    "student_id",
    "program",
    "summary",
    "competencies",
    "strengths",
    "gaps",
  ],
};

export const STUDENT_ASSESSMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    analysis: {
      ...ANALYSIS_SCHEMA,
      description:
        "Structured, citation-bearing JSON assessment for the student profile.",
    },
    narrative: {
      ...NARRATIVE_SCHEMA,
      description:
        "Markdown narrative report derived from the structured assessment in this same response.",
    },
  },
  required: ["analysis", "narrative"],
  propertyOrdering: ["analysis", "narrative"],
};
