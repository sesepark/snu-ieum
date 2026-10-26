FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/catalog/package.json packages/catalog/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --include=dev
COPY apps apps
COPY packages packages
COPY data data
RUN mkdir -p /var/lib/ieum/raw && chown node:node /var/lib/ieum/raw
USER node
CMD ["npm", "run", "start", "-w", "@ieum/api"]
