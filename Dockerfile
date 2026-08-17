FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev
COPY backend ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
ENV PORT=4000
ENV DATA_DIR=/data
EXPOSE 4000
CMD ["node", "src/server.js"]
