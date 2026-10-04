FROM node:24-alpine

LABEL org.opencontainers.image.title="Sohken"
LABEL org.opencontainers.image.description="A local security checkpoint for agent actions"
LABEL org.opencontainers.image.source="https://github.com/MelkiZedekICT/sohken.1-manage"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev \
    && mkdir -p /data \
    && chown node:node /data

COPY . .

EXPOSE 7860

ENV PORT=7860
ENV SOHKEN_HOST=0.0.0.0
ENV SOHKEN_ALLOW_REMOTE=true
ENV SOHKEN_HOME=/data

VOLUME ["/data"]

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:7860/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "bin/sohken.mjs", "serve"]
