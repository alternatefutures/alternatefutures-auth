FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Clean any existing dist and build with esbuild (bundles everything into single file)
# Note: @prisma/client is external since it's dynamically linked
RUN rm -rf dist && npx esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --format=esm --packages=external

# Remove devDependencies after build
RUN npm prune --production

# Re-generate Prisma client after pruning (needed for runtime)
RUN npx prisma generate

# Expose port (configurable via PORT env var, defaults to 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000;require('http').get('http://localhost:'+port+'/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

# Start server
# DATABASE_URL is provided at runtime via Infisical
CMD ["node", "dist/index.js"]
