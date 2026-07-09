FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/app/.local/bin:${PATH}"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

# Create an unprivileged user to run the app.
RUN useradd --create-home --uid 10001 app

COPY pyproject.toml uv.lock README.md ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

RUN uv sync --frozen \
    && chown -R app:app /app

USER app

EXPOSE 8000

# Migrations are NOT run here — they are a separate deploy step (see the
# `migrate` service in docker-compose) so concurrent replicas never race.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
