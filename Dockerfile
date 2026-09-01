# Render: Dockerfile Path = Dockerfile, context = repository root.
# PORT задаёт Render. Аптаймбот бьёт HEAD /health.

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r app \
  && useradd -r -g app app

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/shared-kernel/package.json packages/shared-kernel/tsconfig.json ./packages/shared-kernel/

RUN npm ci

COPY . .

ENV PORT=8000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

RUN mkdir -p /app/output/charts \
  && chown -R app:app /app

USER app

EXPOSE 8000

CMD ["npm", "start"]
