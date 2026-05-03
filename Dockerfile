FROM node:20-alpine

RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY challenge/package.json ./
RUN npm install --omit=dev

COPY challenge/ ./

RUN chown -R app:app /app
USER app

EXPOSE 1337

CMD ["node", "server.js"]
