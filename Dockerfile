FROM node:22-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

ENV PATH="/app/node_modules/.bin:$PATH"
ENV SEED_ON_START=true
EXPOSE 3000

CMD ["node", "scripts/start-production.mjs"]
