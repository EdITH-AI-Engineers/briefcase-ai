.PHONY: help install generate analyze evaluate pipeline api ui dev test typecheck build

help:
	@echo "Briefcase AI commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install    Install dependencies for all packages with bun"
	@echo ""
	@echo "Pipeline:"
	@echo "  make generate   Generate synthetic student profiles"
	@echo "  make analyze    Analyze generated profiles with Gemini"
	@echo "  make evaluate   Run offline analysis evaluator"
	@echo "  make pipeline   Run generate, analyze, and evaluate"
	@echo ""
	@echo "Apps:"
	@echo "  make api        Start the Hono API server"
	@echo "  make ui         Start the Vite React UI"
	@echo "  make dev        Print two-terminal dev instructions"
	@echo ""
	@echo "Checks:"
	@echo "  make test       Run dashboard API unit tests"
	@echo "  make typecheck  Typecheck packages that expose typecheck scripts"
	@echo "  make build      Build the UI"

install:
	cd synth-data-gen && bun install
	cd genai-analysis && bun install
	cd briefcase-api && bun install
	cd briefcase-ui && bun install

generate:
	cd synth-data-gen && bun run generate

analyze:
	cd genai-analysis && bun run analyze

evaluate:
	cd genai-analysis && bun run evaluate

pipeline: generate analyze evaluate

api:
	cd briefcase-api && bun run dev

ui:
	cd briefcase-ui && bun run dev

dev:
	@echo "Start the API and UI in separate terminals:"
	@echo ""
	@echo "Terminal 1:"
	@echo "  make api"
	@echo ""
	@echo "Terminal 2:"
	@echo "  make ui"
	@echo ""
	@echo "Current caveat: the API serves fixture data until the real run adapter is added."

test:
	cd briefcase-api && bun run test

typecheck:
	cd genai-analysis && bun run typecheck
	cd briefcase-api && bun run typecheck
	cd briefcase-ui && bun run typecheck

build:
	cd briefcase-ui && bun run build
