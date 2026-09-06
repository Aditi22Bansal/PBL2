#!/usr/bin/env bash
# One-time setup: generates the SSH keypair used to bootstrap the Ansible target
# container. Run this ONCE from ansible/ before the first `docker compose build`/`up`
# — the target image's Dockerfile bakes in keys/id_rsa.pub at build time, so it must
# already exist before the image is built.
#
#   cd ansible
#   ./setup.sh
#   docker compose up --build -d
#
# Re-running this script is safe (it refuses to overwrite an existing key), but if you
# ever DO need to rotate the key, delete ansible/keys/id_rsa* first, then re-run this
# and `docker compose build --no-cache target` so the new public key gets baked in.
#
# The generated keys/id_rsa (private) and keys/id_rsa.pub (public) are real key
# material and are gitignored at the repo root — never commit them.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

mkdir -p keys

if [ -f keys/id_rsa ]; then
  echo "keys/id_rsa already exists — not overwriting. Delete it first if you want to rotate the key."
  exit 0
fi

ssh-keygen -t ed25519 -f keys/id_rsa -N "" -C "roomsync-ansible-demo"
chmod 600 keys/id_rsa
chmod 644 keys/id_rsa.pub

echo ""
echo "Generated keys/id_rsa (private, gitignored) and keys/id_rsa.pub (baked into ansible/target/Dockerfile at build time)."
echo "Next: docker compose up --build -d"
