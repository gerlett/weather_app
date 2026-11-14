# wetter-bridge: Home Assistant MQTT bridge (stateless, no database)
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs stations.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.mjs"]
