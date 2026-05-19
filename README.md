# briefcase-ai

Bun workspace monorepo for the Briefcase AI demo pipeline.

## Setup

Install once from the repository root:

```sh
bun install
```

Copy the root environment template and add your Gemini key:

```sh
cp .env.example .env
```

Packages load the root `.env`. Package-local `.env` files are not required.

## Workspace packages

| Path | Role |
| --- | --- |
| `packages/shared` | Shared contracts, competency names, guards, env loading, and root path helpers. |
| `packages/synth-data-gen` | Generates synthetic student profiles with Gemini. |
| `packages/genai-analysis` | Analyzes profiles against the root framework bundle. |
| `packages/api` | Hono API that reads latest analysis output. |
| `packages/ui` | Vite React dashboard that talks to the API over HTTP. |

Data flow stays file and HTTP based:

```txt
packages/synth-data-gen -> output/profiles/run-*/profiles.json
packages/genai-analysis -> output/analysis/run-*/*
packages/api           -> reads output/analysis
packages/ui            -> reads packages/api over HTTP
```

Framework markdown lives in `frameworks/`. Runtime artifacts live in root `output/`, which is gitignored.

## Commands

Use Bun scripts directly or the Makefile wrappers:

| Command | Description |
| --- | --- |
| `bun run generate` / `make generate` | Generate profiles into `output/profiles/run-*`. |
| `bun run analyze` / `make analyze` | Analyze the latest profile run into `output/analysis/run-*`. |
| `bun run evaluate` / `make evaluate` | Evaluate the latest analysis run. |
| `bun run pipeline` / `make pipeline` | Run generate, analyze, then evaluate. |
| `bun run api` / `make api` | Start the Hono API on port `8787`. |
| `bun run ui` / `make ui` | Start the Vite UI on port `5173`. |
| `bun run test` / `make test` | Run API unit tests. |
| `bun run typecheck` / `make typecheck` | Typecheck all workspace packages. |
| `bun run build` / `make build` | Build the UI. |

For local dashboard development, run API and UI in separate terminals:

```sh
make api
make ui
```

If no analysis output exists yet, the API returns an empty latest-dashboard state and the UI prompts you to run the pipeline.
