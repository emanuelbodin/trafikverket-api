# NPM
FROM node:24-alpine AS npm
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN  npm ci

# Builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY ./src ./src
COPY tsconfig.json package.json package-lock.json ./
RUN npm ci
RUN ./node_modules/.bin/tsc

# Runner
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=npm /app/node_modules ./node_modules
COPY --from=builder /app/dist ./

ENV SERVER_PORT=3000
EXPOSE $PORT

CMD ["node", "app.js"]
