FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001
CMD ["node", "dist/server.js"]
