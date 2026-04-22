import { Type, type Schema } from "@google/genai";

export const MODEL = "gemini-3.1-flash-lite-preview";

export type ColumnSpec = {
  type: Type;
  description: string;
  enum?: string[];
  nullable?: boolean;
  items?: Schema;
};

export const COLUMNS: Record<string, ColumnSpec> = {
  id: {
    type: Type.STRING,
    description: "RFC 4122 v4 UUID, unique per profile.",
  },
  full_name: {
    type: Type.STRING,
    description:
      "Realistic full name reflecting the country_of_residence. Vary cultures, scripts transliterated to Latin.",
  },
  email: {
    type: Type.STRING,
    description:
      "Plausible email derived loosely from full_name, across diverse providers (gmail, proton, outlook, custom domains).",
  },
  age: {
    type: Type.INTEGER,
    description: "Integer age between 18 and 85.",
  },
  gender: {
    type: Type.STRING,
    description: "Gender identity.",
    enum: ["male", "female", "non-binary", "prefer_not_to_say"],
  },
  country_of_residence: {
    type: Type.STRING,
    description:
      "ISO 3166-1 alpha-2 country code. Spread across continents — avoid clustering on a single country.",
  },
  occupation: {
    type: Type.STRING,
    description:
      "Specific job title (e.g. 'Pediatric Nurse', 'Freight Dispatcher'), not generic categories.",
  },
  annual_income_usd: {
    type: Type.INTEGER,
    description:
      "Plausible annual income in USD given occupation and country. Range 0–500000.",
  },
  education_level: {
    type: Type.STRING,
    description: "Highest completed education level.",
    enum: [
      "none",
      "primary",
      "secondary",
      "vocational",
      "bachelors",
      "masters",
      "doctorate",
    ],
  },
  interests: {
    type: Type.ARRAY,
    description: "3–6 distinct hobbies or interests, lowercase short phrases.",
    items: { type: Type.STRING },
  },
  signup_date: {
    type: Type.STRING,
    description: "ISO-8601 date (YYYY-MM-DD) between 2019-01-01 and today.",
  },
  is_active: {
    type: Type.BOOLEAN,
    description: "Whether the user is currently active.",
  },
};

export const CONTEXT = `
You are generating a synthetic dataset of user profiles for testing a SaaS analytics
platform. Profiles must be internally consistent (income ~ occupation ~ education ~
country) but collectively maximally diverse across:
  - geography (all inhabited continents represented)
  - age brackets (Gen Z through Boomers)
  - socioeconomic status (not all white-collar; include trades, students, retirees,
    gig workers, public sector)
  - cultural/naming conventions
No two rows should share the same full_name, email, or id. Avoid stereotypes and
placeholder-looking data (no "John Doe", no "test@test.com", no "Example Corp").
`.trim();

export const GENERATION = {
  batchSize: 20,
  totalRows: 100,
  temperature: 1.1,
  outputDir: "output",
  useFlex: true,
  useCache: true,
  cacheTtlSeconds: 3600,
};

export const MIN_CACHE_TOKENS = 1024;
