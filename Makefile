.PHONY: install db-start db-stop db-reset ingest export test lint

install:
	uv sync
	npm install

db-start:
	npx supabase start

db-stop:
	npx supabase stop

db-reset:
	npx supabase db reset

ingest:
	uv run python -m ingest daily

export:
	uv run python -m ingest export

test:
	uv run pytest

lint:
	uv run ruff check ingest
