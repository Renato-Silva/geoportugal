FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# postinstall (nuxt prepare) needs the sources; `nuxt build` prepares anyway
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir .data && chown node:node .data
VOLUME /app/.data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
