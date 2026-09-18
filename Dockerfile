FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads
CMD ["sh","-c","node db/migrate.js && node db/seed.js && node server.js"]
