FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system tenantflow && adduser --system --ingroup tenantflow tenantflow

COPY pyproject.toml README.md ./
COPY app ./app
RUN python -m pip install --no-cache-dir .

USER tenantflow
EXPOSE 8000

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
