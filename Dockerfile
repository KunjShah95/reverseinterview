## Multi-stage build for a production container
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY pnpm-lock.yaml* ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
# Default command: if you use a Node server, adapt this to your server entry
CMD ["node", "dist/server/index.js"]
