FROM node:24-alpine

WORKDIR /app

# Copy package metadata and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production


COPY . .


EXPOSE 7860

ENV PORT=7860
ENV SOHKEN_HOST=0.0.0.0
ENV SOHKEN_ALLOW_REMOTE=true

CMD ["node", "bin/sohken.mjs", "serve"]
