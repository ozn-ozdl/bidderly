FROM node:22-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server.js ./
COPY sites ./sites
ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002
CMD ["node", "server.js"]
