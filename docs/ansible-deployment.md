# Ansible Deployment

Configuration management via Ansible: a fresh Ubuntu target is provisioned from
nothing (Docker installed, a deploy user created, the app configured and started)
entirely by a playbook, then deploys the *real* images GitHub Actions built and
pushed to GHCR (see [docs/ci-pipeline.md](ci-pipeline.md)) — no local build anywhere
in this path.

## Setup used

Two Docker containers, not a real remote host — a deliberate, documented
simplification (see below), not an attempt to look like more than it is:

- **`target`** (`ansible/target/Dockerfile`): a plain Ubuntu 22.04 box with only
  `sshd` + Python 3 baked in — the minimum a real fresh VM needs before Ansible could
  reach it at all. Everything else (Docker, the deploy user, the app) is installed by
  the playbook, not the image.
- **`control`** (`ansible/control/Dockerfile`): Python + Ansible + an SSH client.
  Nothing else.

Both run on a shared Docker network (`ansible/docker-compose.yml`). `control` connects
to `target` over real SSH, using a keypair generated once by `ansible/setup.sh`
(gitignored — see `ansible/keys/.gitkeep`).

### Docker-outside-of-Docker

`target` bind-mounts the **host's** `/var/run/docker.sock`. When the playbook later
runs `docker compose up -d` inside `target`, that command is talking to the same real
Docker engine this whole setup itself runs on — the containers it starts
(`roomsync-mongo`, `roomsync-backend`, etc.) are real, host-level siblings of `target`
and `control`, not nested inside `target`'s own namespace. That's why the verification
below checks `docker ps` on the **host**, not inside any container.

**This is a known simplification appropriate for a local/educational demonstration.** A
real deployment target would be an actual remote host reached over a real network, and
if a container needed to manage Docker at all, it would use a properly isolated
Docker-in-Docker setup (its own `dockerd`), not a mounted host socket — mounting the
host socket effectively hands the container root-equivalent control over the entire
host engine, which is fine for a disposable local demo and not something you'd do
against a real production host.

## What the playbook does (`ansible/playbook.yml`)

1. **Install packages** — adds Docker's official apt repository (Ubuntu 22.04's own
   repos only carry the deprecated standalone `docker-compose` v1, not the `docker
   compose` v2 plugin the rest of this playbook needs) and installs `docker-ce`,
   `docker-ce-cli`, `containerd.io`, `docker-compose-plugin`, plus `curl` and `git`.
2. **Create a `roomsync_deploy` system user**, added to the `docker` group, with a
   real home directory.
3. **Align access to the mounted Docker socket** — the socket's group ownership
   belongs to the *host's* Docker Desktop, not this fresh container's newly-created
   `docker` group, so they don't automatically match. The playbook checks the
   socket's actual GID and either aligns the local `docker` group to it, or — if the
   socket is root-owned (as it was in this run) — relaxes the socket's permissions
   instead, since there's no non-root group to align to. Documented here rather than
   silently assumed to "just work."
4. **Create `/opt/roomsync`**, owned by `roomsync_deploy`.
5. **Template a production-style `docker-compose.yml`** (Jinja2, `templates/docker-compose.yml.j2`)
   using the real GHCR image references
   (`ghcr.io/aditi22bansal/pbl2-{backend,frontend,python-service}:latest`) — no
   `build:` context anywhere — with `FRONTEND_PORT`/`BACKEND_PORT`/`PYTHON_PORT`/`MONGO_PORT`
   set to `4000`/`6000`/`9000`/`28017`, deliberately distinct from the normal
   `3000`/`5000`/`8000`/`27017` (which were confirmed in use by an unrelated,
   already-running local dev stack before this task started).
6. **Template `.env`** (`templates/env.j2`) — placeholder `NEXTAUTH_SECRET` and
   `INTERNAL_SERVICE_KEY` (the shared secret python-service now requires on every
   route except `/health`/`/metrics` — see [SECURITY.md](../SECURITY.md) §3, added
   specifically because this deployment shape publishes python-service on a real
   host port), and the correct internal `MONGO_URI`/`PYTHON_SERVICE_URL`
   (service-name DNS, not `localhost` — these run on the deployed compose network,
   unaffected by whatever host ports are chosen), mode `0600`.
7. **Handler**: `docker compose pull && docker compose up -d` in `/opt/roomsync`, run
   as `roomsync_deploy` — fires only if step 5 or 6 actually changed something.

## Real problems found while building this

Documented honestly rather than smoothed over, since this is exactly the kind of
detail a reflection report should contain:

- **A Docker Desktop / WSL crash mid-build** (`running wslexec ... exit status
  0xffffffff` unmounting the WSL VHDX) hit partway through the very first
  `docker compose up --build`. Investigated rather than just retried: the host's C:
  drive had only **11.54 GB free** out of ~314 GB — a near-full system disk is a
  well-known real trigger for exactly this VHDX failure. Recovery was `wsl --shutdown`
  + relaunching Docker Desktop; the pre-existing `kind` cluster from the Kubernetes
  task (`docs/k8s-deployment.md`) was confirmed to have survived (`kubectl get nodes`
  → `Ready`, every pod back to `Running`) before proceeding. A conservative cleanup
  pass followed: `docker ps -a` showed no partially-built containers from this crashed
  attempt (the crash hit before any container was created, only mid-image-build), and
  the other stopped containers present on the host all belonged to unrelated,
  pre-existing projects (Jenkins, Temporal, a couple of Postgres/Redis labs, etc.) —
  left untouched rather than assumed disposable. A conservative `docker image prune`
  (dangling/untagged images only) ran regardless, though it reclaimed a negligible
  amount (~317 kB) — the real disk pressure is tied up in other projects' large,
  named, still-tagged images, out of scope to remove unilaterally.
- **A corrupted containerd snapshot reference** (`docker system df` errored with
  `lstat .../snapshots/3419/fs: no such file or directory`) persisted after the crash
  recovery. Core operations (`build`, `pull`, `ps`, `image prune`) all still worked
  normally, so this was left as a known cosmetic issue rather than chased into a
  deeper Docker Desktop repair out of scope for this task.
- **The crash-interrupted `control` image build had cached a broken dependency
  set** — `pip install ansible` had been mid-flight when the crash hit, and the
  resulting image imported with `ImportError: cannot import name 'NativeEnvironment'
  from 'jinja2.nativetypes'`. Rebuilding `control` with `--no-cache` (treating the
  crash-adjacent layer as suspect rather than trusting it) resolved cleanly to
  `ansible==14.3.1` / `ansible-core==2.21.3` / `jinja2==3.1.6`.
- **Bind-mounted SSH key had the wrong permissions.** `ansible/keys/` is mounted from
  the Windows host into both containers, but Docker Desktop's cross-OS file sharing
  doesn't preserve POSIX permission bits on that mount (NTFS has none to preserve) —
  the private key always showed up as `0777` inside the container, and OpenSSH
  correctly refused to use it ("UNPROTECTED PRIVATE KEY FILE"). Fixed with a small
  `control/entrypoint.sh` that copies the key into the container's own filesystem and
  `chmod 600`s it there (a real chmod, on a real container-native file, sticks) before
  handing off to the actual command — the bind mount itself stays, per the original
  design, only the path Ansible actually reads the key from moved.
- **Ubuntu 22.04's own apt repos don't carry a `docker compose` v2 plugin** — only the
  deprecated standalone `docker-compose` v1 binary, which doesn't provide the `docker
  compose` (space) subcommand the playbook's handler needs. Fixed by adding Docker's
  official apt repository and installing `docker-ce`/`docker-ce-cli`/`containerd.io`/`docker-compose-plugin`
  from there instead, matching Docker's own documented installation method.
- **`playbook.yml`/`inventory.ini`/`templates/` were originally baked into the
  `control` image via `COPY`**, which meant every playbook edit needed a full image
  rebuild to test. Switched to bind-mounting them from the host instead (`control`
  keeps only its own `entrypoint.sh` baked in) — same content, much faster iteration,
  no change to what's actually demonstrated.

## Idempotency proof

First run (abbreviated — full packages/user/socket/template tasks, see above):

```
PLAY RECAP *********************************************************************
roomsync_target            : ok=13   changed=10   unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
```

Second run, immediately after, no changes made in between:

```
TASK [Install apt prerequisites for adding Docker's official repository] *******
ok: [roomsync_target]
TASK [Ensure /etc/apt/keyrings exists] *****************************************
ok: [roomsync_target]
TASK [Add Docker's official GPG key] *******************************************
ok: [roomsync_target]
TASK [Add Docker's official apt repository] ************************************
ok: [roomsync_target]
TASK [Install Docker Engine, CLI, and the Compose v2 plugin] *******************
ok: [roomsync_target]
TASK [Create roomsync_deploy system user] **************************************
ok: [roomsync_target]
TASK [Check the mounted Docker socket's real ownership] ************************
ok: [roomsync_target]
TASK [Align local docker group GID with the mounted socket's group] ************
skipping: [roomsync_target]
TASK [Socket is root-owned on this host — relax its permissions instead...] ****
ok: [roomsync_target]
TASK [Create /opt/roomsync owned by the deploy user] ***************************
ok: [roomsync_target]
TASK [Template production docker-compose.yml] **********************************
ok: [roomsync_target]
TASK [Template .env (secrets/internal URLs)] ***********************************
ok: [roomsync_target]

PLAY RECAP *********************************************************************
roomsync_target            : ok=12   changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
```

`changed=0` across the board, and — critically — **no `RUNNING HANDLER` section
appears at all** in the second run: since neither templated file actually changed,
`docker compose pull && docker compose up -d` correctly never re-fired.

## Live deployment verification

On the **host** (not inside any container — see the Docker-outside-of-Docker note
above):

```
NAMES                      IMAGE                                              PORTS
roomsync-frontend          ghcr.io/aditi22bansal/pbl2-frontend:latest         0.0.0.0:4000->3000/tcp
roomsync-backend           ghcr.io/aditi22bansal/pbl2-backend:latest          0.0.0.0:6000->5000/tcp
roomsync-mongo             mongo:7                                            0.0.0.0:28017->27017/tcp (healthy)
roomsync-python-service    ghcr.io/aditi22bansal/pbl2-python-service:latest   0.0.0.0:9000->8000/tcp
```

Real, host-level containers, running the exact images CI pushed, on the four
deliberately-distinct ports — not a local build.

A real browser session (Playwright driving the actual installed Chrome, not a stub)
against `http://localhost:4000`:

1. **Login page** loads correctly (`docs/ansible-screenshots/01-login-page.png`).
2. Since this is a brand-new deployment with a **fresh, empty MongoDB volume**, no
   organization exists yet — the multi-tenant domain gate correctly rejects any login
   attempt until one is registered (redirects to `/unauthorized`), exactly as designed
   (see [docs/decisions.md](decisions.md) §4). An organization was registered against
   the real deployed backend directly:
   ```
   POST http://localhost:6000/api/auth/register-organization
   -> 201 {"organization":{"name":"Ansible Demo Institute","allowedEmailDomains":["ansible-demo.edu"]}, "founder":{"role":"ADMIN"}}
   ```
3. Logging in as that founding admin (`founder@ansible-demo.edu`) lands cleanly on
   `/admin`, zero console errors, zero failed requests — a genuine, correctly-isolated
   empty dashboard for the brand-new org (`docs/ansible-screenshots/02-admin-dashboard.png`).
4. Logging in as a student on the same domain lands on `/student`, renders the full
   profile questionnaire correctly (`docs/ansible-screenshots/03-student-dashboard.png`).

### The `NEXT_PUBLIC_API_URL` caveat — checked live, not assumed

The public `pbl2-frontend:latest` image has `NEXT_PUBLIC_API_URL` baked into its
client JS bundle at CI build time, to `http://localhost:5000` (see
[docs/decisions.md](decisions.md) §9 / `frontend/Dockerfile`) — it cannot be changed
by this deployment's environment variables, since that value is inlined at `next
build` time, long before Ansible ever runs. This deployment's real backend is on port
`6000`, not `5000`, so anything that calls that baked-in URL directly from the browser
is misdirected.

Grep-checked which code paths actually do that
(`frontend/src/lib/api.ts`'s `API_URL` export): only **Socket.IO** (`student/page.tsx`,
`RoomChat.tsx`) and the **org-registration page** call it directly from client-side
JS. Everything else — login, the admin and student dashboards, chat *reads*, change
requests — goes through the server-side proxy route
(`/api/proxy/[...path]`, see [docs/architecture.md](architecture.md)), which runs
inside the frontend container and reaches the backend over the internal Docker
network hostname (`http://backend:5000`), completely unaffected by which host port
either service is published on.

Confirmed live, not just reasoned about: the student dashboard load logged exactly one
failure —

```
FAILED_REQUESTS=["http://localhost:5000/socket.io/?EIO=4&transport=polling&... -> net::ERR_CONNECTION_REFUSED"]
```

— a clean, unambiguous connection refusal (nothing was listening on 5000 at the time),
and nothing else. Login, both dashboards, and every other checked interaction worked
normally. Real-time notifications and chat would not work correctly in this specific
deployment shape without also rebuilding the frontend image with
`NEXT_PUBLIC_API_URL=http://localhost:6000` — out of scope here, since the whole point
of this task was deploying the existing CI-built `:latest` image as-is, not rebuilding
it.

### Publishing python-service on a host port is a real security-relevant choice, not just a networking detail

Unlike the K8s deployment (`ClusterIP`-only — see
[docs/k8s-deployment.md](k8s-deployment.md)), this deployment publishes python-service
directly on host port `9000`. That service has no user-level auth of its own; it was
only ever safe because nothing but the Node backend could reach it. A later security
audit of this project caught that gap and closed it (see [SECURITY.md](../SECURITY.md)
§3): every route now requires the `INTERNAL_SERVICE_KEY` shared secret this deployment
already sets in `.env` (see above).

**`ClusterIP`-only remains the correct, recommended shape for any real deployment.**
The internal-service-key is defense in depth for a shape like this one that doesn't
have that network isolation — it is not a substitute for it. Publishing this port was
appropriate here specifically because the goal was local verification (confirming the
GHCR images actually work when Ansible-deployed), on a machine only the operator
themselves can reach. It should not be done against a real, network-reachable host
without, at minimum, this key in place (now true) and a firewall rule restricting the
port to trusted callers only.

## Bringing it up / tearing it down

One-time setup:

```bash
cd ansible
./setup.sh                 # generates keys/id_rsa(.pub) — required before the first build
```

Bring the whole demo up:

```bash
docker compose up --build -d
docker exec ansible-control ansible-playbook -i inventory.ini playbook.yml
```

Tear the deployed app down (leaves `target`/`control` running, `/opt/roomsync` and the
Mongo volume intact for next time):

```bash
docker exec -u roomsync_deploy ansible-target sh -c "cd /opt/roomsync && docker compose down"
```

Tear the whole demo down (what this task did after verification):

```bash
cd ansible
docker compose down
```

## Final state

Verified working end-to-end, then torn down — `docker ps` shows no `ansible-*` or
`roomsync-*` containers remaining on the host. Re-running the two "bring it up"
commands above reproduces the exact same result, since every step is a real, idempotent
Ansible task rather than a one-off manual sequence.
