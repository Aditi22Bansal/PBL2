# RoomSync — Next.js frontend.
#
# PRODUCTION mode (npm run build + npm start), not `next dev`. Reasoning:
#   - This is infra meant to model the real deployed shape of the app, not a live-reload
#     dev loop (no source bind-mount is set up here, so dev mode would buy nothing).
#   - The app has already been build-tested (docs/stabilization_checklist.md Part 2
#     confirms `npm run build` succeeds; next.config.mjs sets `ignoreBuildErrors: true`
#     specifically to keep production builds working through pre-existing TS issues).
#   - `next dev`'s Turbopack HMR server isn't meant for containers without a mounted
#     source volume, and is slower/heavier for a service that's just supposed to be "up".
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are inlined into the client JS bundle at build time by Next.js -
# they MUST be present before `next build` runs; setting them later via `docker run -e`
# or compose `environment:` would be too late and silently ignored by already-built
# client code. Override via `--build-arg` / compose `build.args` (docker-compose.yml
# does this, keyed off the same host port the frontend/backend containers publish on -
# so it stays correct even if those ports are remapped to avoid a conflict).
#
# NEXT_PUBLIC_API_URL must be a HOST-reachable URL (e.g. http://localhost:5000) because
# it's read by browser-side code (frontend/src/lib/api.ts) running on the developer's
# machine, outside Docker's network - "http://backend:5000" would NOT resolve there.
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ARG NEXT_PUBLIC_DEV_AUTH=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEV_AUTH=$NEXT_PUBLIC_DEV_AUTH

RUN npm run build

# Server-side-only vars (NextAuth callbacks, the /api/student/profile proxy route) run
# inside this container's own Node process, which IS on the compose network - so these
# use the Docker service name, not localhost. docker-compose.yml's `environment:`
# overrides these defaults at container-start time (build already happened above).
ENV BACKEND_URL=http://backend:5000
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=docker-compose-dev-secret-change-me
ENV PORT=3000

EXPOSE 3000

# node:20-alpine ships a built-in non-root "node" user (uid 1000) - standard
# hardening so a compromise inside this container doesn't run as root.
USER node

CMD ["npm", "start"]
