.PHONY: help install generate analyze evaluate pipeline api ui dev test typecheck build

help:
	@echo "Briefcase AI commands"
	@echo "  make install    Install root Bun workspace dependencies"
	@echo "  make generate   Generate synthetic student profiles"
	@echo "  make analyze    Analyze generated profiles with Gemini"
	@echo "  make evaluate   Run offline analysis evaluator"
	@echo "  make pipeline   Run generate, analyze, and evaluate"
	@echo "  make api        Start the Hono API server"
	@echo "  make ui         Start the Vite React UI"
	@echo "  make test       Run API unit tests"
	@echo "  make typecheck  Typecheck workspace packages"
	@echo "  make build      Build the UI"

install:
	bun install

generate:
	bun run generate

analyze:
	bun run analyze

evaluate:
	bun run evaluate

pipeline:
	bun run pipeline

api:
	bun run api

ui:
	bun run ui

dev:
	bun run dev

test:
	bun run test

typecheck:
	bun run typecheck

build:
	bun run build
