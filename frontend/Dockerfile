# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN yarn build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

# Install express
RUN npm install express@4.18.2

# Copy server.js and build from builder
COPY server.js .
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run server
CMD ["node", "server.js"]
