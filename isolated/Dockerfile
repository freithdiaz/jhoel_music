FROM python:3.11-slim-bookworm
WORKDIR /app
RUN pip install --no-cache-dir yt-dlp==2026.10.26 yt-dlp-ejs==0.8.0
COPY isolated/egress.py isolated/worker.py isolated/ipc.py ./
USER 65534:65534
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENTRYPOINT ["python"]
