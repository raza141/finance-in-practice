FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv

# Install dependencies first for better layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

RUN useradd --create-home --uid 1000 api && chown -R api /srv
USER api

ENV PATH="/srv/.venv/bin:$PATH"
# Which proxies uvicorn trusts for X-Forwarded-For (the client IP used for rate
# limiting). Set to the load balancer's IP/CIDR, or "*" only when the container
# is reachable exclusively through a trusted proxy (Render, Fly, Railway...).
ENV FORWARDED_ALLOW_IPS="127.0.0.1"
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
