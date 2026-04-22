# briefcase-ai

Monorepo for AI-assisted data and tooling projects. Each package is self-contained — its own `package.json`, `node_modules`, and `.env`. No root-level workspace; `cd` into a package and run it there.

## Packages

| Path | Description |
| --- | --- |
| [`synth-data-gen`](./synth-data-gen) | Synthetic user-profile generator built on `@google/genai`. Schema-enforced JSON output, per-run checkpointing, flex inference, context caching. |

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
