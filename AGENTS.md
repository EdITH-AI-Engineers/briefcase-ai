# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Briefcase AI is a Bun workspace monorepo for a demo pipeline:

```txt
packages/synth-data-gen -> output/profiles/run-*/profiles.json
packages/genai-analysis -> output/analysis/run-*/*
packages/api           -> reads output/analysis
packages/ui            -> reads API over HTTP
```

Workspace packages:

- `packages/shared`: shared contracts, competency names, guards, env loading, and root path helpers.
- `packages/synth-data-gen`: Gemini synthetic student profile generation.
- `packages/genai-analysis`: Gemini assessment and narrative generation against framework docs.
- `packages/api`: Hono API server running on Bun/tsx.
- `packages/ui`: Vite React dashboard.

Root data directories:

- `frameworks/`: checked-in framework markdown and manifest.
- `fixtures/demo-run/`: checked-in demo fixture data.
- `output/`: gitignored runtime artifacts.

## Package Manager and Runtime

Use Bun from the repository root.

```sh
bun install
bun run typecheck
bun run test
bun run build
```

Do not add npm, pnpm, or yarn lockfiles. The only JavaScript lockfile should be root `bun.lock`.

## Environment

Use one root `.env` file. Do not require package-local `.env` files.

Required key for LLM pipeline runs:

```txt
GEMINI_API_KEY=...
```

Use `packages/shared/src/env.ts` for root env loading.

## Development Commands

Preferred root commands:

```sh
bun run generate
bun run analyze
bun run evaluate
bun run pipeline
bun run api
bun run ui
bun run dev
bun run test
bun run typecheck
bun run build
```

Makefile wrappers call these same root scripts:

```sh
make dev
make api
make ui
make test
make typecheck
make build
```

`make dev` / `bun run dev` starts both API and UI and cleans up both processes on exit. Use separate `make api` and `make ui` terminals only when debugging one side independently.

## Architecture Rules

Keep dependency direction simple:

```txt
@briefcase/shared
  ↑
  ├── @briefcase/synth-data-gen
  ├── @briefcase/genai-analysis
  ├── @briefcase/api
  └── @briefcase/ui
```

Rules:

- Packages may import `@briefcase/shared`.
- Packages should not import each other's internals.
- Generator and analyzer communicate through files under `output/`.
- API reads analysis output from the filesystem.
- UI talks to API over HTTP only.
- UI must not depend on Gemini, filesystem output paths, or Node-only APIs.

## Shared Contracts

Use `packages/shared` for cross-package contracts and constants.

Important files:

- `packages/shared/src/types.ts`: profile and analysis types used at file/package boundaries.
- `packages/shared/src/dashboard.ts`: dashboard DTOs shared by API and UI.
- `packages/shared/src/competencies.ts`: canonical competency names.
- `packages/shared/src/guards.ts`: lightweight runtime guards at file boundaries.
- `packages/shared/src/paths.ts`: root path helpers.
- `packages/shared/src/env.ts`: root `.env` loader.

When adding or changing data exchanged between packages, update shared types first, then package code.

Do not duplicate dashboard DTOs in API or UI. Import or re-export `StudentDashboardDto` from `@briefcase/shared`.

## Analyzer and Recommendation Flow

The analyzer decides competency levels, gaps, recommendations, and optional `search_keywords` during `bun run analyze`.

The API does not re-assess students. It derives dashboard scores, roadmap nodes, and LinkedIn Learning recommendation URLs from analysis output.

LinkedIn recommendation logic lives in:

```txt
packages/api/src/services/linkedin-search.ts
packages/api/src/services/dashboard-builder.ts
```

Rules for recommendation work:

- Treat model-provided `search_keywords` as untrusted input.
- Sanitize, deduplicate, and clamp AI keywords before generating URLs.
- Keep `RecommendationSource` accurate:
  - `ai_keywords`
  - `curated_competency`
  - `gap_recommendation`
  - `competency_name`
- Add or update API tests when changing URL generation, keyword fallback, or difficulty mapping.

## UI Bundle and Heavy Components

The UI lazy-loads heavy dashboard components to keep the initial bundle smaller:

```txt
packages/ui/src/components/ScoreCharts.tsx
packages/ui/src/components/Roadmap.tsx
```

Do not eagerly import React Flow or Recharts into `App.tsx` unless you intentionally accept a larger initial bundle. Prefer `React.lazy`/`Suspense` for heavy visualization panels.

## UI Accessibility

Interactive graph content should have a keyboard-accessible fallback.

The roadmap currently supports:

- mouse interaction through React Flow nodes,
- keyboard-accessible detail buttons below the canvas.

When adding interactive UI, avoid mouse-only paths. Buttons and links must be focusable and must have visible focus states.

## Output and Fixtures

Runtime outputs must go under root `output/`:

```txt
output/profiles/run-*/profiles.json
output/analysis/run-*/*
```

Do not commit files from `output/`.

Fixtures that are intentionally checked in belong under:

```txt
fixtures/demo-run/
```

## Framework Files

Framework markdown lives under root `frameworks/`.

The analyzer should resolve framework files through shared root path helpers, not package-local relative paths.

## Testing and Verification

Before changing code, identify the narrowest relevant verification command.

After changing code, usually run:

```sh
bun run typecheck
bun run test
bun run build
```

For UI changes, also run:

```sh
bun run build
```

For API service changes, run:

```sh
bun run test
```

For path or workspace changes, also verify:

```sh
find . -name bun.lock -print
```

Expected result is only:

```txt
./bun.lock
```

## LLM Pipeline Caution

`bun run generate`, `bun run analyze`, and `bun run pipeline` can call Gemini and consume tokens. Do not run them unless explicitly needed and a valid `GEMINI_API_KEY` is expected to be present.

Typechecks, tests, and UI builds should not require Gemini calls.

Current model choices:

- Synthetic profile generation: configured in `packages/synth-data-gen/src/config.ts`.
- Analysis: configured in `packages/genai-analysis/src/config.ts`.

Avoid switching models casually. If changing model names, verify provider availability and explain cost/quality tradeoffs.

## Git Hygiene

Before finalizing changes:

```sh
git status --short
git diff --stat
git diff
```

Confirm:

- no secrets are staged,
- no `output/` artifacts are staged,
- no package-local lockfiles are staged,
- no generated `dist/` or `*.tsbuildinfo` files are staged,
- root `bun.lock` is the only Bun lockfile.

## Protected and Generated Files

Do not edit lint or hook configuration to bypass failures.

Do not commit:

- `.env`,
- `output/`,
- `node_modules/`,
- `dist/`,
- `*.tsbuildinfo`,
- package-local `bun.lock` or `package-lock.json` files.

## Style and Scope

Keep changes minimal and mechanical unless the user asks for redesign.

For bug fixes:

1. Reproduce or inspect the issue.
2. Identify the root cause.
3. Make the smallest targeted change.
4. Re-run the same verification.
5. Review the diff.

For monorepo or path changes, prefer shared helpers over hardcoded `../../..` paths.
