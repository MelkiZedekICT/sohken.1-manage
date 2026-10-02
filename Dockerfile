FROM node:24-alpine

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

CMD ["node", "bin/sohken.mjs", "serve"]
