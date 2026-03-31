FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

ENV SEED_ON_START=true
EXPOSE 3000

CMD ["node", "scripts/start-production.mjs"]
