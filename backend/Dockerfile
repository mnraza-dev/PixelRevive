FROM oven/bun:1.4.2 AS bun
FROM python:3.11-slim-bookworm
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ca-certificates util-linux && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.lock /app/requirements.lock
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.lock
ENV PYTHON_BIN=/opt/venv/bin/python U2NET_HOME=/opt/models DATA_DIR=/data NUMBA_CACHE_DIR=/data/numba OMP_NUM_THREADS=2 NODE_ENV=production PORT=3001 HOST=0.0.0.0
RUN mkdir -p /opt/models /data && /opt/venv/bin/python -c "from rembg import new_session; new_session('u2netp')" && useradd --uid 10001 --create-home studio && chown -R studio:studio /data /opt/models
COPY backend/*.js backend/worker.py /app/backend/
COPY backend/entrypoint.sh /app/backend/entrypoint.sh
RUN chmod 755 /app/backend/entrypoint.sh
USER studio
ENTRYPOINT ["/app/backend/entrypoint.sh"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD bun -e 'const r = await fetch("http://127.0.0.1:3001/ready"); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "backend/proxy.js"]
