# frameworks/

Drop your skills-framework document here as a single markdown (or plain-text) file. `src/config.ts` points at one file at a time via `ANALYSIS.frameworkPath`.

The file is read verbatim and embedded into the model's system instruction between `=== SKILLS FRAMEWORK ===` markers, so structure it for a reader, not for code. Any framework that enumerates competencies and a proficiency scale will work — for example:

- DigComp 2.2 (digital competence)
- SFIA (tech skills)
- CEFR (language proficiency)
- OECD "Future of Education and Skills 2030" competencies
- A custom rubric produced internally

Recommended shape for the file:

```
# <Framework name and version>

## Competencies
- **<Competency name>** — short description of what it covers.
- **<Competency name>** — ...

## Proficiency scale
- **<Level 1 name>** — description
- **<Level 2 name>** — description
- ...

## Evidence guidance (optional)
Any framework-specific rules about what counts as evidence for which
competency — e.g. which certifications map to which levels.
```

The prompt builder uses the competency and level names from this file verbatim. Renaming a level here renames it in every analysis. No code change needed.

## Token-count note

Context caching activates only when the system instruction (role brief + framework + evaluation rules) clears 1024 tokens — Gemini's Flash-tier minimum. A terse framework may fall below that and caching will no-op with a warning. If you want cache hits, err on the side of a complete framework document (full competency descriptions, scale with meaningful definitions, optional evidence guidance).
