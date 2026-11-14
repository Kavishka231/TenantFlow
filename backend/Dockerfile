FROM python:3.15-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build
RUN python -m venv "$VIRTUAL_ENV"

COPY pyproject.toml README.md ./
COPY app ./app
RUN python -m pip install --upgrade pip \
    && python -m pip install .

FROM python:3.15-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN addgroup --system --gid 10001 tenantflow \
    && adduser --system --uid 10001 --ingroup tenantflow --home /nonexistent tenantflow

COPY --from=builder /opt/venv /opt/venv

USER tenantflow
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/api/v1/health\", timeout=3)"]

CMD ["sh", "-c", "exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port \"${PORT:-8000}\" --no-server-header"]
