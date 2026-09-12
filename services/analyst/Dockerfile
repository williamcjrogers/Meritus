FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS web
WORKDIR /build/web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile
COPY web/ ./
ARG VITE_MERITUS_BASE_PATH=/
ARG VITE_MERITUS_EMBEDDED=false
ENV VITE_MERITUS_BASE_PATH=$VITE_MERITUS_BASE_PATH VITE_MERITUS_EMBEDDED=$VITE_MERITUS_EMBEDDED
RUN corepack pnpm build

FROM ghcr.io/astral-sh/uv:0.12.9@sha256:8b940d3a9d65bed080436972241af2e21c84b5e8c9193f7014ed71479ee795ff AS uv
FROM python:3.12.14-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254
COPY --from=uv /uv /uvx /usr/local/bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src/ src/
RUN uv sync --locked --no-dev
COPY --from=web /build/web/dist /app/web/dist
RUN useradd --uid 10001 --create-home meritus && mkdir -p /app/data && chown meritus:meritus /app/data
USER meritus
EXPOSE 8088
CMD ["meritus", "serve", "--host", "0.0.0.0", "--port", "8088"]
