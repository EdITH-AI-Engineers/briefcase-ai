import { Type, type Schema } from "@google/genai";

export const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    student_id: {
      type: Type.STRING,
      description: "Must equal the profile's id field verbatim.",
    },
    summary: {
      type: Type.STRING,
      description:
        "1–2 sentence holistic assessment grounded in the framework.",
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
        required: ["name", "level", "evidence", "confidence"],
        propertyOrdering: ["name", "level", "evidence", "confidence", "notes"],
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
  required: ["student_id", "summary", "competencies", "strengths", "gaps"],
  propertyOrdering: [
    "student_id",
    "summary",
    "competencies",
    "strengths",
    "gaps",
  ],
};
