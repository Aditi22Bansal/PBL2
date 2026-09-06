# RoomSync — Node/Express backend (REST architecture: talks to python-service over HTTP,
# not by spawning a subprocess — see services/allocationService.js).
FROM node:20-alpine

WORKDIR /app

# Install deps first so this layer is cached unless package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the backend source. .dockerignore excludes node_modules, venv,
# __pycache__, data/*.csv and .env — none of those belong in the image.
COPY . .

# Defaults for local `docker build`/`docker run` outside compose. docker-compose.yml
# sets these explicitly in its `environment:` block, and compose env wins over these
# (Dockerfile ENV only supplies the image's baked-in default).
ENV PORT=5000
ENV MONGO_URI=mongodb://127.0.0.1:27017/hostel_allocator
ENV PYTHON_SERVICE_URL=http://python-service:8000
ENV USE_REST_ALLOCATION=true

EXPOSE 5000

# node:20-alpine ships a built-in non-root "node" user (uid 1000) - standard
# hardening so a compromise inside this container doesn't run as root.
USER node

CMD ["node", "server.js"]
