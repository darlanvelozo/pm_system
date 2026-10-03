FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY backend/ .
RUN useradd --system --uid 10001 app && chown -R app /app
USER app
EXPOSE 8000
# Proxy headers: the real client IP comes from Caddy (CF-Connecting-IP), so the login rate limit is per user, not global.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-access-log --proxy-headers --forwarded-allow-ips '*'"]
