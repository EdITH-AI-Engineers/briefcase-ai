# briefcase-ai

Extension for briefcase.

Monorepo for AI-assisted data and tooling projects. Each package is self-contained — its own `package.json`, `node_modules`, and `.env`. No root-level workspace; `cd` into a package and run it there.

## Packages

| Path | Description |
| --- | --- |
| [`synth-data-gen`](./synth-data-gen) | Synthetic student-profile generator built on `@google/genai`. Emits schema-enforced JSON (skills, certifications, awards, education, projects, experience), checkpoints per batch, uses flex inference and context caching. |
| [`genai-analysis`](./genai-analysis) | Evaluates student profiles against an external skills framework (loaded from `frameworks/*.md`). Produces structured, evidence-grounded assessments. Consumes output from `synth-data-gen`. |

The two packages are contract-coupled: `synth-data-gen`'s `COLUMNS` in `src/config.ts` stay field-aligned with `StudentProfile` in `genai-analysis/src/types.ts`.

## Running from the Makefile

Use the root `Makefile` for day-to-day development. It keeps the packages self-contained, but gives you one command surface from the repo root.

First install dependencies with Bun:

```sh
make install
```

Run the synthetic-data pipeline:

```sh
make pipeline
```

This runs:

```txt
generate -> analyze -> evaluate
```

Start the dashboard in two terminals:

```sh
# Terminal 1
make api

# Terminal 2
make ui
```

Then open the Vite URL printed by `make ui`, usually:

```txt
http://localhost:5173
```

Useful targets:

| Target | Description |
| --- | --- |
| `make generate` | Generate synthetic student profiles. |
| `make analyze` | Analyze the latest generated profiles with Gemini. |
| `make evaluate` | Run the offline analysis evaluator. |
| `make pipeline` | Run `generate`, `analyze`, and `evaluate` in order. |
| `make api` | Start the Hono API server on port `8787`. |
| `make ui` | Start the Vite React UI on port `5173`. |
| `make dev` | Print the two-terminal API/UI startup instructions. |
| `make test` | Run dashboard API unit tests. |
| `make typecheck` | Typecheck packages with typecheck scripts. |
| `make build` | Build the dashboard UI. |

The dashboard API reads real analysis runs from `genai-analysis/output/run-*`. If no run exists yet, the UI shows an empty state telling you to run `make pipeline`.

## Adding a package

```
mkdir <name>
cd <name>
bun init -y
```

Keep it self-contained. Shared tooling can be promoted to the root later if more than one package needs it.

## Conventions

- Secrets live in each package's `.env` (gitignored). Commit `.env.example` with the required keys.
- Generated artifacts go under the package's `output/` (gitignored).
- TypeScript, ES modules, `tsx` for dev runs.
