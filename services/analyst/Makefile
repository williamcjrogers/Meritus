.PHONY: configure start stop test lint build logs
configure:
	uv run python scripts/configure.py
start: configure
	docker compose up --build -d
stop:
	docker compose stop
test:
	uv run pytest -q
	corepack pnpm --dir web test
lint:
	uv run ruff check src tests scripts
	uv run ruff format --check src tests scripts
	corepack pnpm --dir web typecheck
build:
	corepack pnpm --dir web build
	docker compose build app
logs:
	docker compose logs --tail=100 app worker
