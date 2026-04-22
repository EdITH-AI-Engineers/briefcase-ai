# briefcase-ai

Extension for briefcase.

Monorepo for AI-assisted data and tooling projects. Each package is self-contained — its own `package.json`, `node_modules`, and `.env`. No root-level workspace; `cd` into a package and run it there.

## Packages

| Path | Description |
| --- | --- |
| [`synth-data-gen`](./synth-data-gen) | Synthetic student-profile generator built on `@google/genai`. Emits schema-enforced JSON (skills, certifications, awards, education, projects, experience), checkpoints per batch, uses flex inference and context caching. |
| [`genai-analysis`](./genai-analysis) | Evaluates student profiles against an external skills framework (loaded from `frameworks/*.md`). Produces structured, evidence-grounded assessments. Consumes output from `synth-data-gen`. |

The two packages are contract-coupled: `synth-data-gen`'s `COLUMNS` in `src/config.ts` stay field-aligned with `StudentProfile` in `genai-analysis/src/types.ts`.

## Adding a package

```
mkdir <name>
cd <name>
npm init -y
```

Keep it self-contained. Shared tooling can be promoted to the root later if more than one package needs it.

## Conventions

- Secrets live in each package's `.env` (gitignored). Commit `.env.example` with the required keys.
- Generated artifacts go under the package's `output/` (gitignored).
- TypeScript, ES modules, `tsx` for dev runs.
