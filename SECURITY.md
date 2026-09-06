# Security

RoomSync is an academic project (BTech PBL), not a live public product — this document
is written with that in mind. It's a factual record of the two real vulnerabilities
found and fixed during development, the one known-but-currently-safe limitation, and
how tenant data isolation is enforced, plus how to flag something if you find it.

## Vulnerabilities found and fixed

### 1. Admin routes had zero authentication

**What was found.** Investigating the real authentication architecture (in order to
build the Next.js proxy + `getServerSession()` design — see
[docs/decisions.md](docs/decisions.md)) surfaced that only `/api/student/profile*` had
any genuine session-verified identity. Every admin route had **no identity signal at
all** — no session check, no role check, nothing derived server-side. The dashboard
route additionally trusted a raw URL parameter (`/dashboard/:email`) to decide whose
data to render, and the chat and change-request handlers trusted client-supplied
body/query fields for who the acting user was.

**Impact.** Any request to an admin endpoint — no login, no token, nothing — was
served as if it came from an admin. `/dashboard/:email` let anyone view any other
user's dashboard by editing the URL. Chat and change-request actions could be
attributed to an arbitrary user by editing the request body.

**The fix.** `requireAuth` / `requireAdmin` Express middleware, applied to every
admin/student/chat route, that looks up the real `User` document from a
server-derived, trusted identity and attaches `req.currentUser` — role always read
fresh from the database, never from the request. On the frontend, one generic
authenticated proxy route (`frontend/src/app/api/proxy/[...path]/route.ts`) calls
`getServerSession()` and attaches `X-User-Email` itself; the header is never something
the browser supplied, so there's nothing in the request for a client to forge.
`/dashboard/:email` was changed to parameterless `/dashboard`, removing the spoofing
vector structurally instead of merely validating it.

**How closure was verified.** Requests to an admin endpoint with a forged
`X-User-Email` header but no real session still return `401`. A logged-in student's
request to an admin endpoint returns `403`. A logged-in student attempting to view a
*different* student's dashboard, or attribute a chat message to a different user, by
editing the request body/query still only ever acts as themselves — because the
identity the backend trusts is derived server-side from the verified session, not
copied from anything the client sent.

### 2. Client-controlled role escalation via the login upsert

**What was found.** `POST /api/auth/sync-user` (called on every login) wrote `role`
from client-supplied `req.body` into MongoDB's `$set` on an upsert — on *every* call,
not just account creation. A logged-in student who edited the request body of their
own routine login sync call, or exploited the role-picker UI accepting arbitrary
client-side selection, could set their own account's `role` to `ADMIN`.

**Impact.** Full privilege escalation for any authenticated user, with no admin
approval step and no server-side check anywhere in the path — the only "verification"
was reading back a value the client itself had just sent.

**The fix.** Two independent changes, in the order verification actually required
(see [CLAUDE.md](CLAUDE.md) for the commit-by-commit record):
- Split the upsert into `$setOnInsert: { role: 'STUDENT' }` (only ever applied the
  *first* time a document is created) and `$set: { name, avatarUrl, organizationId }`
  (applied on every call, but `role` is structurally absent from it — there is no
  code path left that can overwrite an existing user's role from a login request).
- On the frontend, NextAuth's `signIn()` callback overwrites `user.role` with the
  value `sync-user` actually returned from the database, before `jwt()` ever reads it
  — so `session.user.role` reflects a verified DB lookup, not whatever the login
  form's role picker had selected client-side.

**How closure was verified.** Re-running the exact exploit (a POST to `sync-user` with
a forged `role: "ADMIN"` body, from an existing `STUDENT` account) no longer changes
the stored role — confirmed by reading the user back from the database after the
request. Logging in as a real student and explicitly selecting "Admin" at the
dev-login role picker keeps that session on the student experience — it no longer
even lands on the admin page shell. The real admin account and a newly-created
founding admin (from organization registration) both still land on `/admin` correctly,
confirming the fix didn't also break legitimate admin access.

### 3. python-service had no authentication of its own

**What was found.** A routine dependency/security audit (checking whether every
route added since the original auth work still had real auth — see `docs/decisions.md`
and `CLAUDE.md`) surfaced that `backend/main.py` (the FastAPI allocation engine) had
**no auth mechanism at all** on any of its routes — `/allocate/v2`, `/admin/allocations`,
`/admin/unassigned`, `/admin/sync-google-sheet`, etc. It was designed to be safe only
because it's meant to be unreachable except from the Node backend (K8s deploys it as
`ClusterIP`-only — see [docs/k8s-deployment.md](docs/k8s-deployment.md)). That
assumption had already broken once in this project: the Ansible deployment publishes
it directly on a host port for local verification (`docs/ansible-deployment.md`), with
no auth of its own to fall back on if that port were ever reachable by anything else.
CORS (`allow_origins=["*"]`) and an unrestricted outbound fetch in
`/admin/sync-google-sheet` (a real SSRF vector — the URL was fetched with no allowlist
at all) made the exposure worse in that scenario, not better.

**Impact.** In any deployment shape where python-service's port ends up reachable
beyond the Node backend, a caller could trigger allocations, read all allocation data,
or abuse the sync-google-sheet endpoint to probe internal network addresses — with
zero credentials.

**The fix.** Every route in `main.py` now requires a shared secret
(`X-Internal-Service-Key` header, checked against `INTERNAL_SERVICE_KEY`) via a single
middleware — except `/health` and `/metrics`, which K8s probes and Prometheus's
scraper have no way to attach a custom header to, and which expose nothing beyond
liveness/process metrics. `backend/services/allocationService.js` sends this header on
every call. CORS is now a configured allowlist (`CORS_ALLOWED_ORIGINS`, empty/deny-all
by default) instead of `*`. Both `sync-google-sheet` handlers (Node and Python) now
reject any URL whose hostname isn't exactly `docs.google.com` or
`spreadsheets.google.com` before fetching anything.

**Deployment guidance.** `ClusterIP`-only (the K8s shape) remains the correct,
recommended way to run this service — the internal-service-key is defense in depth
for any shape that doesn't have that isolation, not a replacement for it. The Ansible
demo's host-port publishing was for local verification only and should not be pointed
at a real reachable host without, at minimum, this key in place (now true) and a
firewall rule restricting the port to trusted callers.

## Known, currently-safe limitation

**The `join_user` Socket.IO channel is unauthenticated** — it accepts a client-asserted
user identifier with no server-side verification, at the same trust level as the
existing `join_room` channel. This is safe *today* because the channel is push-only
and carries nothing more sensitive than a room number for routing live notifications —
there is no read of private data and no write gated behind it. It must be authenticated
(the same way the HTTP layer now is) before anything sensitive is ever added to it;
tracked as a known item, not something to bolt on defensively for a risk that doesn't
exist yet.

## Multi-tenant data isolation

Every collection (`User`, `Profile`, `HostelConfiguration`, `RoomAllocation`,
`ChangeRequest`, `Chat`, `Notification`) carries a required `organizationId`, resolved
once at login from the user's verified email domain
(`Organization.findOne({ allowedEmailDomains: emailDomain })`) and stamped onto their
`User` document — never re-derived from anything the client sends on later requests.
Every controller query is scoped by that stored `organizationId`. Domain ownership
itself is enforced at the database level: `Organization.allowedEmailDomains` has a real
MongoDB unique multikey index, so two organizations cannot claim the same domain even
if application logic were bypassed. Verified end-to-end: a brand-new organization's
dashboard is completely empty on first login, with zero visibility into any other
organization's students, rooms, configurations, or chat. Full data model in
[docs/architecture.md](docs/architecture.md).

## Reporting an issue

This is an academic project without a live user base, paid support, or a security
bounty program — there's no formal disclosure SLA to promise. If you find a problem
while reviewing or building on this code, the most useful thing is a GitHub issue on
[Aditi22Bansal/PBL2](https://github.com/Aditi22Bansal/PBL2) describing what you found
and how to reproduce it. If it involves real data from the live SIT Pune dataset this
project was built against, please don't include that data in the issue itself —
describe the mechanism instead.
