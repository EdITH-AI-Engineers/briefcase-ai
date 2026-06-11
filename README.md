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

## Profile sparsity requirements

Before loading a student dashboard, the UI can call:

```txt
GET /api/runs/:runId/students/:studentId/sparsity-check
```

The API warns when a profile is `Missing` or `Sparse`, or when a section is present but below its minimum item count.

| Section | Accepted profile fields | Minimum items |
| --- | --- | --- |
| Skills | `skills` | 2 |
| Projects | `projects` | 1 |
| Organizations | `organizations_memberships` | 1 |
| Certifications | `certifications`, `licenses_certifications` | 1 |
| Awards | `awards`, `honors_awards` | 1 |
| Education | `education`, `educational_qualification`, `educational_qualifications` | 1 |
| Experience | `experience`, `work_experience` | 1 |
| Trainings | `seminars_trainings` | 1 |

Sparsity levels are based on how many of those eight sections contain data: `Missing` is 0-1 filled sections, `Sparse` is 2-3, `Complete` is 4-6, and `Rich` is 7-8.

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
