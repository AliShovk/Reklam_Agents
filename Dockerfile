FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc || true

COPY .env.example .env.example

EXPOSE 3333

CMD ["npx", "tsx", "src/index.ts"]
