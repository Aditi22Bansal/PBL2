#!/bin/sh
# The keys/ directory is bind-mounted in from the host (Windows) so both containers
# can see it (see ansible/docker-compose.yml) — but Docker Desktop's cross-OS file
# sharing doesn't preserve POSIX permission bits on that mount (NTFS has none to
# preserve), so the private key always shows up as world-readable/writable there,
# which OpenSSH correctly refuses to use ("UNPROTECTED PRIVATE KEY FILE"). Copying it
# once into the container's own filesystem lets a real chmod actually stick.
set -e
mkdir -p /root/.ssh
cp /keys/id_rsa /root/.ssh/id_rsa
chmod 600 /root/.ssh/id_rsa
exec "$@"
