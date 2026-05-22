FROM node:20-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source only
COPY backend/ ./backend/

# Expose port
EXPOSE 4000

# Start Express server
CMD ["node", "backend/server.js"]
