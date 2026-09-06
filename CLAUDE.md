# RoomSync — Project Context for Claude Code

## What this is
RoomSync (GitHub: PBL2) — hostel roommate-allocation platform. BTech final year project, 
being evolved into a generalized B2B SaaS while also satisfying a DevOps course rubric 
(CI/CD, IaC, containers/K8s, monitoring, reflection report).

## Critical workflow rules — ALWAYS FOLLOW
- `main` is now a stable checkpoint — do NOT commit, push, or merge directly to `main` 
  anymore. All new work happens on `ahmad-dev` (or branches created from it). If a prompt 
  asks to touch `main` directly, flag that this contradicts the current workflow and 
  confirm before proceeding rather than just doing it.
- NEVER run git commit, push, stash, checkout, reset, or any command that discards/rewrites 
  the working tree — UNLESS explicitly instructed in the current prompt. Default is 
  local-only, no git operations.
- Windows machine, PowerShell. Real project root: E:\pbl_hostel\PBL2 (not the outer 
  E:\pbl_hostel, which has its own separate, unused, empty git repo — ignore it)
- Real repo remote: github.com/Aditi22Bansal/PBL2, active working branch ahmad-dev 
  (main is the stable checkpoint, not where work happens; feature/microservices was the 
  prior working branch, now merged into main via PR #2)
- When editing a file that already has unrelated pre-existing uncommitted changes, only 
  touch what the current task asks for — leave other in-flight changes alone, and say so 
  in your report.

## Architecture (current, as of 2026-09-02)
Real REST-based microservices — NOT subprocess-spawn anymore (that was refactored out):
- frontend/ — Next.js 16.2 (App Router), React 19.2, NextAuth (dev-auth mode via 
  DEV_AUTH=true / NEXT_PUBLIC_DEV_AUTH=true, no real passwords needed locally), port 3000
- backend/ — Node/Express 5, Mongoose 9, Socket.IO, port 5000. Calls the Python service 
  over HTTP when USE_REST_ALLOCATION=true (this is now the default)
- Python service — FastAPI (main.py), port 8000. POST /allocate/v2 is the live endpoint 
  (wraps ml_engine/executor.py's compute_allocation()). The old CLI/subprocess path and 
  legacy /api/allocate route still exist as fallback but are not the live path.
- MongoDB — system of record, port 27017

## Docker
docker-compose.yml at PBL2/ root runs all 4 services. Dockerfiles: backend/Dockerfile 
(Node), backend/Dockerfile.python (FastAPI), frontend/Dockerfile (Next.js, production 
build, not dev mode). Known gotcha: NEXT_PUBLIC_API_URL must stay host-reachable 
(localhost) since it's baked into the client bundle at build time; BACKEND_URL (server-side) 
correctly uses the backend's Docker service name. If `docker compose up --build` fails 
resolving registry-1.docker.io, that's a known local BuildKit DNS quirk — retry with 
DOCKER_BUILDKIT=0.
IMPORTANT: the Compose stack's Mongo is a fresh container/volume, separate from any 
locally-running Mongo Windows service. Real demo data (if any) living in a local Mongo 
install will NOT appear inside the Compose stack unless deliberately migrated.

## Ports & conflicts
Manual dev servers (node server.js, npm run dev, uvicorn) commonly already occupy 
3000/5000/8000/27017 locally. Don't kill processes on these ports without asking — report 
conflicts and let the user decide.

## Resource discipline
Don't leave the Docker Compose stack AND the devops-lab kind cluster running
simultaneously unless a task actually needs both at once (e.g. comparing behavior
between them) — running both plus normal tooling (browser, editor, this session
itself) has caused real resource-contention problems on this machine before: a live
mongo `CrashLoopBackOff` in the K8s deployment, traced to a 1-second probe timeout
being exceeded under load, not any real mongod failure (see `k8s/mongo.yaml`'s
probe `timeoutSeconds` comment). `%UserProfile%\.wslconfig` now caps WSL2 (which
Docker Desktop runs inside) to roughly half this machine's RAM/CPUs as a backstop,
but the cheaper fix is just not running everything at once. Two scripts make
"only run what's needed" the easy path instead of a habit to remember:
- `scripts/dev-down-all.ps1` — releases the Compose stack and the `roomsync`/
  `monitoring` K8s namespaces back to idle (leaves the shared kind cluster itself
  and its other unrelated namespaces alone).
- `scripts/dev-up-k8s.ps1` — re-applies all of `k8s/` in dependency order onto the
  existing cluster; images are GHCR pulls, not rebuilds, so this is fast.

## Product direction (multi-tenant B2B SaaS — done)
Hard constraints the allocation engine must NEVER violate: no mixed-gender rooms, no
smoking/alcohol incompatibility — both enforced as absolute pre-filters (poisoned
similarity-matrix cells + gender bucketing), not scored/traded-off features. 100% of
students placed via a two-phase optimize-then-guarantee design; the rare genuinely
irreconcilable case is reported via `needsManualPlacement` (named blocking
constraint) rather than silently dropped or force-placed. Full design + the real
production violation this fixed: [docs/decisions.md](docs/decisions.md) §2-3,
[docs/architecture.md](docs/architecture.md).

## Security — fixed (worth citing as a real found-and-fixed vulnerability)
Client-trusted role escalation via login, closed. `POST /api/auth/sync-user` used to
accept `role` straight from the request body and write it via an upsert on EVERY
login (`routes/auth.js`) — any user could set `role: 'ADMIN'` client-side (a cookie
the login page set itself, or a plain form field for the dev-login provider) and
their account would be silently promoted to ADMIN the next time they signed in, no
invitation or approval needed. Fixed: `role` is no longer read from the request body
at all; a brand-new user is created with `role: 'STUDENT'` via `$setOnInsert` only,
and an existing user's `role` is never included in the update, so nothing sent by a
client can ever write it again, on login or otherwise. Verified live: repeatedly
POSTing `role: 'ADMIN'` for an existing real student left their DB role at STUDENT
(and calling an admin-only endpoint as them still correctly 403s, since `requireAdmin`
re-reads role from the DB fresh on every request); the real admin account's
pre-existing `role: 'ADMIN'` was confirmed unchanged (no longer self-healing via
upsert, so it must already be correct in the DB — which it is).
Also added: a real MongoDB unique (multikey) index on `Organization.allowedEmailDomains`
(model + real DB index confirmed) — two orgs literally cannot claim the same domain
now; verified a colliding insert is rejected with E11000, not just discouraged by
app logic.

Frontend session role also fixed. `session.user.role` (NextAuth JWT/session) used
to be populated straight from the login form's selected role / the `selectedRole`
cookie, never from the backend's real `User.role` — so even after the write-path
fix above, a student who clicked "Continue as Admin" would still land on the
`/admin` route (blocked from doing anything real, but a confusing broken shell).
Fixed: `signIn()` now overwrites `user.role` with the real role from `sync-user`'s
response before `jwt()` ever reads it, so the session always reflects DB truth,
never the client's own selection. The now-dead cookie-fallback and the pointless
`role` field in the sync-user request body were removed too. Verified live: a real
student selecting "Continue as Admin" is now redirected to `/unauthorized` instead
of ever reaching the admin shell; the real admin and a freshly-created founding
admin both still land on `/admin` correctly when they pick the right role.

python-service had no auth of its own, closed. A dependency/security audit found
`backend/main.py` trusted network isolation alone (K8s `ClusterIP`-only) with zero
auth on any route - already broken once by the Ansible task publishing it on a host
port. Fixed: every route except `/health`/`/metrics` now requires
`X-Internal-Service-Key` (env `INTERNAL_SERVICE_KEY`, sent by
`allocationService.js` on every call); CORS on both Node and Python narrowed from
wildcard to an explicit `ALLOWED_ORIGINS`/`CORS_ALLOWED_ORIGINS` allowlist; both
`sync-google-sheet` handlers (Node + Python) now reject any URL whose host isn't
exactly `docs.google.com`/`spreadsheets.google.com` (closes a real SSRF vector).
Also hardened three admin endpoints (`toggleRoomLock`, `handleRequestAction`,
`accommodateAccessibilityRequest`) that validated `req.body` ID fields with a bare
truthy check (`!roomId`) instead of a real format check - a crafted object like
`{"$ne": null}` would have passed straight through as a Mongo query operator.
Verified live end-to-end, in both Docker Compose and the real K8s cluster: a real
allocation still completes successfully through the full Node→Python call in both
(proving the new internal key plumbing works across the real container/pod network,
not just in isolation - confirmed a direct unauthenticated pod-to-pod call gets a
real 401), the role-escalation and cross-tenant-isolation exploits are both still
blocked, and all 3 Dockerfiles now run as a non-root user (`node`/`appuser`) -
confirmed via `docker exec ... whoami`, not just declared. Also fixed along the way:
`k8s/mongo.yaml`'s probe `timeoutSeconds` (implicit 1s default -> 5s), found via a
live `CrashLoopBackOff` under real resource contention while re-verifying this pass
in the cluster - not a regression from this work, but a real robustness gap worth
closing while there. Full record: [SECURITY.md](SECURITY.md).

Rate limiting, Helmet, and admin audit logging added. `express-rate-limit` on the two
PUBLIC (no requireAuth) endpoints - `sync-user` (60/15min/IP) and
`register-organization` (10/15min/IP, since it's a one-time action per real org) -
skipped only under `NODE_ENV=test` (Jest sets this automatically; verified the real
limiter genuinely 429s by briefly flipping NODE_ENV within a test). `helmet()` added
with its defaults kept as-is - reviewed and live-tested against Socket.IO's real
cross-origin browser handshake and the existing CORS setup, nothing broke, so nothing
was disabled on guesswork. New `AuditLog` model + `logAuditEvent()` helper (same
failure-isolation principle as the notification system - a logging failure can never
block or fail the real admin action), wired into every admin action listed in the
model's `action` enum, plus `GET /api/admin/audit-log` (admin-only, org-scoped,
paginated - backend only, no frontend UI yet). Verified live: real admin actions
produce exactly the right entries, a second org's log stays completely isolated, and
a deliberately-broken audit write (monkeypatched to throw) still lets the real action
return 201 with zero corrupted/partial log entries left behind.

## Org onboarding (done — founding-admin-only)
`POST /api/auth/register-organization` (public, no auth) creates a brand-new
Organization + its founding ADMIN User. Rejects if the domain is already claimed
(the unique index above is the real enforcement; a friendly pre-check gives a
clear message first) and requires the founder's own email to belong to the domain
being registered. This Mongo deployment is standalone (no replica set), so no
multi-document transaction is available — instead: Organization is created first,
then the founding User; if that second insert fails for any reason, the
just-created Organization is deleted as a compensating rollback, so a failed
registration never leaves a stranded org with nobody able to administer it.
Verified: concurrent duplicate-domain registrations — exactly one succeeds, the
loser leaves no orphaned data. `register/page.tsx` is now "Create Your
Organization" (org name, domain, founder name/email) — the old unrestricted
self-attestation checkbox flow is gone entirely. A brand-new org's founding admin
sees a completely empty, correctly isolated dashboard (zero SIT Pune data of any
kind) immediately after registering and logging in.
Multi-admin invite (inviting a second admin into an existing org) is deferred, not
built — today it's founding-admin-only; every org has exactly one admin until a
future invite flow exists.

## DevOps rubric being satisfied alongside this project
CI/CD pipeline (GitHub Actions), config management (Ansible/Puppet), containers + 
Kubernetes (rolling update/rollback demo), monitoring (Prometheus+Grafana), reflection 
report. No fixed deadline. Sequencing so far: REST refactor (done) → Docker (done) → 
CI/CD (done) → K8s (done) → Ansible (done) → monitoring (done) → report (done).
Full DevOps rubric now complete: [docs/reflection-report.md](docs/reflection-report.md).

### CI/CD (done)
`.github/workflows/ci.yml` — push to `ahmad-dev` + PRs targeting `main`. Jobs: 
lint-backend (npm ci + syntax-check, then the real `backend/tests/test_*.js` jest 
suite - see below), lint-frontend 
(npm ci + npm run build - same command already proven in frontend/Dockerfile), 
python-check (py_compile syntax check, then the real `backend/tests/` pytest suite - 
see below), docker-build (all 3 Dockerfiles, 3-way matrix, no live DB needed), and push-images 
(push-only, ahmad-dev only, never on a PR). Images land in 
`ghcr.io/aditi22bansal/pbl2-{backend,frontend,python-service}`, tagged `:<commit-sha>` 
and `:latest`, using the built-in `GITHUB_TOKEN` (no new secrets). Diagram + job-shape 
table: [docs/ci-pipeline.md](docs/ci-pipeline.md).

**Allocation engine test suite (`backend/tests/`, pytest, CI-run).** Encodes the
real, previously-only-manually-verified invariants as permanent tests, using small
deterministic synthetic profile sets (never the real dataset): hard constraints
(gender bucketing, smoking/drinking never roomed together, even when otherwise a
perfect compatibility match), 100% placement accounting, `needsManualPlacement`
correctness (including the gender-scoping fix), `capacityShortfall`'s pre-flight
rejection, room-size preference (honored + graceful fallback +
filler-never-seed), the `MAX_EFFECTIVE_ROOM_SIZE` tier-priority ceiling, and
`room_capacity` accuracy. `pytest` is a test-only dependency
(`backend/requirements-test.txt`, extends `requirements.txt`) - confirmed via a real
`Dockerfile.python` build that it never ships in the production image. 14 tests, runs
in ~1 second. A real test failure fails the `python-check` CI job, not just a syntax
check.

**Backend security test suite (`backend/tests/test_*.js`, jest + supertest +
mongodb-memory-server, CI-run).** Permanent regression tests for the actual proven
vulnerabilities in SECURITY.md, against a real in-memory MongoDB (not a mock - real
unique indexes/query semantics apply): `test_auth.js` (401/403/200 on admin routes,
plus identity coming only from the trusted header - never body/query, mirroring the
original student_54/student_96 exploit), `test_role_escalation.js` (forging
`role: "ADMIN"` via `sync-user`, on both an existing account and first-ever
creation, verified by a direct DB read), `test_tenant_isolation.js` (two orgs, zero
cross-tenant leakage on both the list endpoint and a direct-ID reference; duplicate
domain registration rejected), `test_injection.js` (`{"$ne": null}`-shaped payloads
to the three hardened endpoints, verified with a real unrelated "decoy" document to
prove the query itself was blocked, not just that the collection happened to be
empty). `server.js` now exports `{ app, server, connectDB }` and only
auto-connects/listens when run directly (`require.main === module`) - zero
production behavior change, but lets tests get `app` for supertest without binding a
real port. jest/supertest/mongodb-memory-server are devDependencies only - confirmed
via a real `Dockerfile` build (`npm ci --omit=dev`) that none of them ship in the
production image. Every one of these tests was verified for real: the corresponding
fix was temporarily reverted, the test was confirmed to fail (for the injection
tests, confirmed via actual data mutation on a decoy document, not just a differing
status code), then the fix was restored and the test re-confirmed passing. 11 tests,
runs in a few seconds locally (longer on a cold mongodb-memory-server binary
download). A real test failure fails the `lint-backend` CI job.

### Kubernetes (done)
Manifests in `k8s/`: namespace + ConfigMap + Secret (placeholder) + a Deployment/Service 
pair for each of mongo (+ PVC), python-service, backend, frontend. Deployed to a local 
kind cluster, all 4 pods verified Running/Ready; rolling update (`kubectl set image`) 
and rollback (`kubectl rollout undo`) both demonstrated live end-to-end via a visible 
version badge, with independent raw-HTTP + pod-image verification at each step (not 
just a browser glance — a port-forward-death + stale-local-server mixup during the 
first attempt made that discipline necessary, see docs/k8s-deployment.md for the full 
account). Full writeup, screenshots, and exact commands: 
[docs/k8s-deployment.md](docs/k8s-deployment.md).

### Ansible (done)
Two Docker containers (`ansible/target`, `ansible/control`) stand in for a real 
managed host + control node — `target` mounts the host's real Docker socket 
(Docker-outside-of-Docker), a deliberate, documented local-demo simplification, not a 
real remote target. `ansible/playbook.yml` installs Docker (via Docker's official apt 
repo — Ubuntu 22.04's own repos lack the `docker compose` v2 plugin), creates a 
`roomsync_deploy` system user, and templates a production-style docker-compose.yml + 
.env deploying the real GHCR `:latest` images on 4 deliberately-distinct ports 
(4000/6000/9000/28017). Idempotency proven (`changed=0` on a second run, handler 
correctly doesn't re-fire); real end-to-end browser verification (Playwright) confirmed 
org registration, admin login, and student login all work against the live deployed 
backend. One real caveat found and documented: the frontend image's 
`NEXT_PUBLIC_API_URL` is baked in at CI build time to `localhost:5000`, so Socket.IO 
and org-registration (both direct client-side calls) are misdirected in this 
deployment shape — login/dashboards are unaffected since those go through the 
server-side proxy. A Docker Desktop/WSL crash (caused by a near-full host disk) hit 
mid-build and is documented as a real found-and-recovered issue, not hidden. Full 
writeup: [docs/ansible-deployment.md](docs/ansible-deployment.md).

### Monitoring (done)
Instrumented both `backend` (prom-client middleware wrapping every request - default 
process metrics + `http_request_duration_seconds`/`http_requests_total`, labeled by 
method/matched-route-pattern/status_code) and `python-service` 
(prometheus-fastapi-instrumentator, same shape automatically), both at `GET /metrics`. 
Neither had any prior instrumentation - confirmed by grep, not assumed. Pushed via a 
real commit -> CI built + pushed new GHCR images -> `k8s/backend.yaml`/
`k8s/python-service.yaml` bumped to that SHA and rolled out, same real-image 
discipline as the K8s task. `k8s/monitoring/`: Prometheus (scraping both services 
cross-namespace) + Grafana, with a provisioned datasource and a provisioned 3-panel 
dashboard (uptime/p95 latency/error rate) - no manual UI clicking. Verified with real 
generated traffic (incl. genuine 401s/404s) before screenshotting: Prometheus 
`/api/v1/targets` showed both services `up`, and the dashboard rendered real non-zero 
latency and error-rate data, not an empty/zero one. Full writeup: 
[docs/monitoring.md](docs/monitoring.md).

### Autoscaling (done — python-service only, real load-tested)
`k8s/python-service.yaml` now also carries `resources` (requests: 250m CPU/256Mi,
limits: 500m CPU/512Mi - sized off a real `kubectl top pods` idle reading of ~2m
CPU/128Mi, not guessed) and a `HorizontalPodAutoscaler` (min 1, max 5, target 55% CPU
utilization). `backend`/`frontend` deliberately NOT given an HPA - they're mostly
I/O-bound; `python-service` is the one genuinely CPU-bound service (cosine similarity +
greedy matching), the one [docs/decisions.md](docs/decisions.md) #1's original
subprocess→REST refactor was specifically justified by ("for independent scaling").
Confirmed stateless before trusting horizontal scaling at all (no mutated module-level
state, no DB/file writes on the live `/allocate/v2` path - see
[docs/autoscaling.md](docs/autoscaling.md) for the actual grep-level verification).
metrics-server was already present on this shared `devops-lab` cluster (turned out to
be left over from the `social-media` lab exercise's own HPA, before that namespace was
removed in an unrelated cleanup) - confirmed genuinely working via real `kubectl top`
numbers, not just deployment presence.

Real load test, not just a manifest that was never exercised: k6 (official
`grafana/k6` image, run as a real Job inside the `roomsync` namespace rather than via
`kubectl port-forward` - see the doc for why), 40 VUs sustained 6 minutes, hitting
`/allocate/v2` directly with 300-profile synthetic payloads per call. Real, observed
result: 1 → 5 replicas (the configured ceiling) within ~2.5 minutes under sustained
117-150%/55% CPU pressure, held at 5 for the full plateau, then scaled back down to 1
almost exactly 5 minutes after load eased (matching K8s's default HPA scale-down
stabilization window precisely) - captured with real timestamped
`kubectl get hpa`/`kubectl top pods` samples every 15s throughout, not just a
before/after snapshot. `backend`/`frontend`/`mongo` stayed at exactly 1 pod each the
entire time - the independent-scaling claim held for real, not just on paper.
Correctness held too: 99.14% of 3851 load-test requests succeeded with a valid
allocation shape, and a manually-inspected post-load request confirmed the actual
hard-constraint logic (gender bucketing, smoking-conflict `needsManualPlacement`) still
correct on the same scaled code path. Full methodology, the real replica-count
timeline, and the honest caveat about uneven per-pod load distribution (a load-test
connection-affinity artifact, not an HPA/architecture problem):
[docs/autoscaling.md](docs/autoscaling.md).

## Recently added (features)
- In-app notifications for room allocation. Socket.IO now has a per-student channel 
  (`join_user` -> room `user:<email>`) alongside the existing chat `join_room`, because 
  chat rooms are keyed on an allocation id — which doesn't exist yet for the student 
  who's about to be allocated. The student dashboard (not RoomChat) opens the socket, so 
  it's connected even while unallocated. triggerAllocation notifies ONLY students whose 
  status genuinely flipped: previously-allocated = members of the pre-insert oldAllocs 
  snapshot + lockedEmails, so a re-run never re-notifies people who were already placed. 
  Each notification is both pushed live and persisted (Notification model), so a student 
  who was offline sees it on their next dashboard load; dismissing marks it read.

## Known pre-existing minor bugs (not yet fixed, low priority)
- Dashboard greets allocated-but-unnamed users as "Welcome back, Unknown" 
  (Profile.name defaults to "Unknown Name" instead of falling back to session.user.name)
- /admin/requests shows "Original Assigned Room: Unknown (ID: )" for one stale test record
- "Things to discuss together" can show a duplicate bullet (conflict reasons aren't 
  de-duplicated, unlike recommendations which does use a Set)
- Socket.IO's `join_user(email)` is client-asserted and unauthenticated, matching the 
  existing `join_room` trust level. Safe today — the channel is push-only and carries 
  just a room number — but it MUST be authenticated before anything sensitive goes on it.

## Backlog (deferred, not attempted)
- Branch dropdown (`frontend/src/lib/questionnaireConfig.ts`) is a static hardcoded list 
  (CSE/AIML/RNA/MECHANICAL/ENTC/CIVIL) with zero algorithm coupling (matcher_greedy.py only 
  ever compares branch for equality, never against a specific value) - purely a frontend 
  constraint. Genuinely dynamic per-org values depend on an org-onboarding system that 
  doesn't exist yet; not worth building for one field in an otherwise fully static 
  questionnaire config.
- Real multi-building/wing support (per-block capacity, genuine gender/year overflow across 
  more than one block) is a real future feature, not attempted here. Today's cleanup only 
  removed dead code that implied this already existed (see below) - HostelConfiguration 
  still has no "block"/building concept at all.

## Recently fixed (allocation engine)
- Room-size ceiling (MAX_EFFECTIVE_ROOM_SIZE=6 in matcher_greedy.py): an oversized 
  configured tier (e.g. carnation's capacity:23) is split into ceiling-sized virtual 
  rooms and only used once legitimate configured tiers (<=6) are exhausted — legitimate 
  tiers are always tried first, largest-first within each group. Prevents both mega-rooms 
  and legitimate 2/3/4-bed tiers being starved by a misconfigured larger one.
- needsManualPlacement's "hard_conflict" reason now only compares a stuck student 
  against others of their own gender (was comparing across the full unassigned pool 
  regardless of gender, which could misreport a capacity problem as a hard conflict).
- Room-size preference (soft/best-effort): students can state preferred_room_size 
  (2/3/4/"No preference") in the questionnaire. Per legitimate (non-virtual) capacity 
  tier, matcher_greedy.py runs a preference pass first, seeding groups only from 
  students who explicitly want that size (ranked by pairwise similarity) and using 
  "No preference" students as filler for any leftover slots — never as seeds. Whatever 
  the preference pass can't fill falls through unchanged to the existing fill logic, 
  then Phase 2, so 100% placement is never at risk. preference_satisfaction is computed 
  post-hoc per placed student (room capacity vs. stated preference) and surfaced on the 
  student dashboard's "Why We Matched" card. True no-op when nobody has a preference 
  (100% of real profiles today) — verified byte-identical against the 31-room baseline.
- Room floor is now real and admin-configured, not a computed formula. HostelConfiguration's 
  room templates carry a `floor` field (e.g. "Ground", "1", "2"); adminController.js pulls 
  each placed room's floor from a per-capacity queue built from that real data instead of 
  `Math.floor(id / ROOMS_PER_FLOOR) + 1`. Missing/blank floor (pre-migration configs, or a 
  ceiling-expanded virtual room with no real template to attribute a floor to) defaults to 
  "Ground". Verified: admin-set floor values flow byte-for-byte into RoomAllocation.floor 
  and into room numbers (e.g. "D-G01", "A-101").
- accessibility_need (structured: "None" / "Ground floor required") is a soft, best-effort 
  preference — same questionnaire/Profile/payload pattern as preferred_room_size, including 
  being threaded into the Python payload. But it's honored in adminController.js's Node-side 
  room-assignment step, NOT inside matcher_greedy.py's group-formation: accessibility need 
  doesn't affect WHO groups together (compatibility matching is untouched), only WHICH 
  physical room a formed group lands in — and floor is only known as real data in Node 
  (see the floor-realism fix above), not in Python at all. Accessibility-needing groups get 
  first pick of that capacity's "Ground" floor-queue slots (processed before any other 
  group, mirroring room-size preference's own pass-ordering fix) before falling through to 
  normal assignment — best-effort, placement is never blocked. Satisfaction is tracked the 
  same way (accessibility_satisfaction, post-hoc, only for students with an explicit need) 
  and surfaced on the dashboard. True no-op against real data (nobody has this need yet).
- Structured accessibility accommodation requests: ChangeRequest now has requestType 
  ('GENERAL' | 'ACCESSIBILITY') and requestedAccommodation, with the old free-text `reason` 
  kept as an optional note rather than the thing that used to carry the actual request. 
  For an ACCESSIBILITY request, the admin's Requests panel can query eligible target rooms 
  (right gender — not full branch/year cohort, floor matches, has an open slot, unlocked) 
  and move the student there in one click. The move reuses manualSwap's exact validated 
  core (`_assertUnlocked`/`_resolveMember`/`_assertOpenSlot`/`_applyMove`, refactored out of 
  manualSwap itself) for a single-direction move instead of a two-way swap, then marks the 
  request Approved. GENERAL requests are untouched — still reviewed/swapped manually via 
  the Allocations panel exactly as before.
- Two real multi-tenant domain bugs fixed. (1) NextAuth's signIn callback (frontend) had 
  its own hardcoded `@sitpune.edu.in` checks (Google provider + the legacy Demo Bypass 
  credentials provider) that ran BEFORE the backend's real Organization.allowedEmailDomains 
  lookup ever got consulted, and even then the callback ignored /api/auth/sync-user's 
  response and always returned true. Fixed: both hardcoded checks removed; signIn now 
  awaits sync-user and denies (redirects to /unauthorized) on a non-OK response, uniformly 
  for every provider including DEV_AUTH - a dev-login still has to belong to a real 
  registered org's domain, matching the intent already documented in backend/routes/auth.js. 
  Deliberate behavior change: a sync-user failure (bad domain OR backend unreachable) now 
  fails closed instead of silently letting sign-in through. (2) adminController.js's CSV 
  sync fallback email (for rows with no email column) was hardcoded to 
  `student_N@sitpune.edu.in` regardless of which org was syncing - now derived from that 
  org's real `allowedEmailDomains[0]` (one extra Organization lookup; org context was 
  already in scope). csv_repo.py has the same hardcoded fallback but is legacy/unreachable 
  on the live path (only the old FastAPI CLI endpoints use it) - left as-is with a comment 
  explaining why, lower priority.
- Hardcoded SIT-Pune branding genericized across login/register/unauthorized pages, page 
  title, PDF report header/footer, FastAPI title, and the landing page (testimonial 
  attribution and marketing copy) - all replaced with institution-agnostic text ("your 
  institution" etc.), since there's no per-org branding system yet. Default Google Sheet 
  sync URL blanked (was pre-filled to a specific real sheet). 
- Block-lettering dead code removed (adminController.js's getBlockForRoom/assignRoom): the 
  room-numbering logic used to return a LIST of blocks per gender/year group (e.g. 
  `['B','C']`, `['D','E','F','G']`), implying overflow to a second/third block once the 
  first filled up - but assignRoom's loop returned unconditionally on the first entry, so 
  C/E/F/G were always dead; every non-first-year female room was always B, every male room 
  always D. Now returns a single block letter (A/B/D) directly - same runtime behavior, 
  honest code. Did NOT build real per-block capacity/overflow (see backlog above).
- Fixed duplicate room_number collisions surfaced by the block-lettering cleanup above: 
  adminController.js's within-floor room numbering used `(count % ROOMS_PER_FLOOR) + 1` 
  (ROOMS_PER_FLOOR=8), wrapping back to 01 once a single (block, floor) bucket passed 8 
  rooms - e.g. block D (every male room) can hold 20+ Ground-floor rooms alone, producing 
  several rooms literally named "D-G01". The real database was never actually affected 
  (confirmed: its current room_numbers predate the floor-realism work entirely and were 
  already unique; the collision only ever showed up in a scratch re-trigger during 
  verification), so no data regeneration was needed - just the code path. Fix: removed the 
  modulo entirely; the per-(block,floor) counter now increments naturally (D-G01..D-G22, 
  no wraparound). Numbering-only change - verified byte-identical room composition 
  (member groupings) against the pre-fix baseline.
