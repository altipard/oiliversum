.PHONY: install db-start db-stop db-reset test lint

install:
	uv sync
	npm install

db-start:
	npx supabase start

db-stop:
	npx supabase stop

db-reset:
	npx supabase db reset

test:
	uv run pytest

lint:
	uv run ruff check ingest
