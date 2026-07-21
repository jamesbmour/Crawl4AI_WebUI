# Crawl4AI Web UI — single-image build
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY backend/requirements.txt backend/requirements.txt
# Deps and browsers split across layers to stay under registry per-blob caps
RUN pip install --no-cache-dir playwright patchright litellm scipy \
    && find /usr/local/lib/python3.12 -depth -type d -name __pycache__ -exec rm -rf {} +
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && find /usr/local/lib/python3.12 -depth -type d -name __pycache__ -exec rm -rf {} +
RUN python -m playwright install chromium-headless-shell
RUN python -m playwright install chromium --no-shell
COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist
ENV C4AI_WEBUI_DATA=/data
VOLUME /data
EXPOSE 8742
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8742"]
