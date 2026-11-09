FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MUSIC_DB_PATH=/data/diaz_music_users.db MUSIC_DIR=/data/music \
    MUSIC_DIST_DIR=/app/dist
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 music \
    && mkdir -p /data && chown music:music /data
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /build/dist ./dist
COPY server.py production.py telegram_app_guard.py telegram_bridge_queue.py telegram_deletion_queue.py telegram_match.py ./
COPY isolated/ipc.py ./isolated/ipc.py
COPY scripts ./scripts
USER music
EXPOSE 8589
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8589/api/health', timeout=3)" || exit 1
CMD ["uvicorn", "production:app", "--host", "0.0.0.0", "--port", "8589", "--workers", "1", "--no-proxy-headers", "--no-access-log"]
