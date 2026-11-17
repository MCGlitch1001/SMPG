# Production Dockerfile for SMPG Dual-Mode Application
FROM node:20-slim

WORKDIR /app

# Install build/runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for efficient layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source and assets
COPY assets/ ./assets/
COPY data/ ./data/
COPY schemas/ ./schemas/
COPY bin/ ./bin/
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Compile Vite React frontend into dist/
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose default port
EXPOSE 3000

# Start unified dual-mode server (Web UI SPA + REST API + Remote MCP)
CMD ["npm", "start"]
