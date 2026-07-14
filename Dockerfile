FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

ENV NODE_ENV=production \
    TZ=America/New_York

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "server.js"]
