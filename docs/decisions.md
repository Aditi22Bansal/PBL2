# Engineering Decisions

ADR-style record of the significant decisions actually made on this project, compiled
from git history and [CLAUDE.md](../CLAUDE.md). Each entry is Context → Decision →
Rationale. This isn't a curated highlight reel — it includes the bugs the "right"
decision surfaced along the way, because that's what actually happened.

---

## 1. Subprocess-spawn → real REST microservice

**Context.** The Python allocation engine originally ran as a spawned CLI subprocess
from the Node backend. This meant the "microservice" boundary was fake — the two
processes shared a filesystem-based CSV persistence layer and Node had to manage the
Python process's lifecycle directly.

**Decision.** Refactored to a genuine HTTP boundary: the Node backend calls
`POST /allocate/v2` on a separately-running FastAPI process
(`USE_REST_ALLOCATION=true`, now the default). The Python side became stateless — it
receives the full profile list and config in the request body and returns the computed
allocation, never touching a database itself.

**Rationale.** Correctness carried over by construction, not by chance: both the old
subprocess/CLI path (`run_pipeline.py`, the legacy `/api/allocate` route) and the new
REST path call the exact same underlying function,
`ml_engine/executor.py`'s `compute_allocation()` — the refactor changed *how the
algorithm gets invoked*, not the algorithm itself. The REST path was then verified
end-to-end against the real submitted dataset before being made the default (see
`docs/multi-tenant-design.md`'s repeated reliance on `POST /allocate/v2` as
ground truth for "the live path"). The old CLI/subprocess path and legacy route are
still in the codebase as a fallback, but are not live traffic.

---

## 2. Hard constraints as absolute pre-filters, not scored features — and the real violation this caught

**Context.** Gender was enforced only by a manual, duplicated pre-split
(`girlsFY`/`girlsSenior`/`boysAll`, calling the Python service three separate times) —
not a property the matching engine itself understood. Smoking/drinking were *scored*
features in the cosine-similarity vector, with a narrow hard-conflict carve-out that
only fired if a student happened to select "Lifestyle Habits" as their
`most_important_factor`.

**Decision.** Moved gender partitioning to be the sole responsibility of
`compute_allocation()`'s internal `(gender, branch, year_of_study)` bucketing (deleting
the redundant manual split), with `_assert_single_gender_room()` as a defense-in-depth
invariant that refuses to emit a mixed-gender room. Made `has_hard_conflict()` fire
*unconditionally* on incompatible smoking or drinking, removing the
`most_important_factor` gate entirely, and dropped both from the scored `WEIGHTS` dict
since scoring and hard-filtering the same dimension is redundant.

**Rationale — and the real bug it caught.** Scanning the last real allocation output
before this fix confirmed exactly the failure mode this was meant to close: **room
D-305 paired a smoker/drinker with two non-smoking, non-drinking students** — the old
`most_important_factor`-gated check missed it because neither of them had happened to
flag lifestyle habits as their top priority. A weight, however large, is still a number
a strong match on every other dimension can outweigh; a pre-filter that excludes the
pairing from consideration entirely can't be outweighed by anything. After the fix, the
same 109 real profiles produced 0 mixed-gender rooms, 0 hard-conflict pairs anywhere in
the output, and the specific pair that had been rooming together was no longer roomed
together.

---

## 3. Two-phase allocation + `needsManualPlacement` (not auto-overflow, not full-run rejection)

**Context.** Once hard constraints became absolute, "100% of students placed" and
"constraints never violated" can genuinely conflict at the margin (e.g. the last two
same-gender students left are an irreconcilable smoking/non-smoking pair). Two
tempting-but-wrong resolutions: silently force the placement anyway (an "overflow room"
bypassing the constraint), or reject the entire run over one edge case.

**Decision.** A two-phase pipeline: **Phase 1** runs the existing greedy +
local-search compatibility maximizer, constrained by gender bucketing and hard-conflict
poisoning, and simply leaves anyone it can't cleanly place. **Phase 2** gives every
leftover student a real, individual shot — first at an existing under-capacity room
with zero hard-conflict (best-compatibility candidate among valid options), then at a
new room from unclaimed template capacity. Anyone still unplaced after both phases is
reported in `needsManualPlacement`, named with the specific blocking constraint (e.g.
`hard_conflict`, scoped to compare only against others of their own gender — an earlier
version of this compared across the full cross-gender pool and mislabeled a capacity
problem as a hard conflict; fixed once found). `capacityShortfall` is a separate,
pre-flight-only check that rejects the whole run *before* matching starts if the
configured bed count is simply below the student count.

**Rationale.** Forcing a placement violates the one property that must never be
violated. Rejecting an entire run of 100+ students over one or two genuinely
irreconcilable cases denies everyone else an allocation over a problem affecting almost
none of them. Naming the specific stuck students and why lets an admin resolve the real
edge case directly, while everyone else still gets placed normally — and on the real
109-profile dataset, this list is empty; it exists for the honest edge case, not as the
expected outcome.

---

## 4. Multi-tenant data model: `organizationId` on every collection, resolved once at login

**Context.** None of the six original collections had any tenant concept — every
controller query read from one global pool. Two concrete, already-live bugs this
caused: `HostelConfiguration.isActive` was enforced with a global `updateMany({},
{isActive: false})` (couldn't represent one real institution's simultaneously-active
Male and Female wing configs, let alone two different institutions), and `syncCsv` did
an unscoped `Profile.deleteMany({})` — any admin syncing a CSV wiped every other
institution's students.

**Decision.** Added an `Organization` collection (`name`, `slug`, `allowedEmailDomains`
— the latter with a real MongoDB unique multikey index, not just an app-level check)
and a required `organizationId` on every one of the (now eight) collections. Tenant
context is resolved **once, at login** (`sync-user`'s
`Organization.findOne({allowedEmailDomains: emailDomain})`) and stamped onto the
`User` document — not re-verified from the domain on every subsequent request, so an
already-synced user's session keeps working even if their domain mapping were to
change later. Every controller query gained `organizationId` scoping in one sweep, and
the `isActive` exclusivity was removed entirely (multiple simultaneously-active configs
per org is the correct behavior, not an edge case).

**Rationale.** A backfill-based, optional-then-required migration
(`docs/multi-tenant-design.md` §B.3) meant the live 116-student dataset never had a
moment of downtime or a fork between two schema shapes. Resolving tenant context once
at login rather than per-request keeps the hot path (every authenticated request)
cheap — one field read off an already-fetched `User` document, not a repeated domain
lookup.

---

## 5. Real, server-verified identity: Next.js proxy + `getServerSession()`

**Context.** Only `/api/student/profile*` had genuine session-verified identity.
Admin routes had **zero identity signal at all**. The dashboard route trusted a raw
URL parameter (`/dashboard/:email`). Chat and change-request handlers trusted
client-supplied body/query fields for who the sender was.

**Decision.** One generic authenticated proxy route
(`frontend/src/app/api/proxy/[...path]/route.ts`) in front of every admin/student/chat
call instead of one bespoke route per endpoint. It calls `getServerSession()` and
attaches `X-User-Email: session.user.email` — **always** derived server-side, never
copied from anything the incoming request itself carried. Backend middleware
(`requireAuth`/`requireAdmin`) looks up the real `User` document from that header and
attaches `req.currentUser`, with `role` always read fresh from the database.
`/dashboard/:email` became parameterless `/dashboard` — removing the spoofing vector
structurally rather than merely validating it.

**Rationale.** A generic proxy covers ~20 endpoints across admin/student/chat with no
per-route boilerplate to keep in sync as new endpoints are added, at the (accepted)
cost of no per-endpoint request customization beyond content-type passthrough (needed
for the CSV report download). Verified directly against the live app: a forged
`X-User-Email` header with no real session still 401s; a logged-in student attempting
to read a *different* student's dashboard by forging the header still only ever sees
their own data, because the header the backend trusts was never the one the client
sent in the first place.

---

## 6. Room-capacity / mega-room bugs — a three-commit chain, each fix surfacing the next

**Context.** `room_capacity` was being read from a FIFO queue built from the config's
template list in emission order — a value with no actual relationship to which
template a given formed room came from.

**Decision & chain of discovery:**
1. Fixed `room_capacity` to reflect the algorithm's *actual* per-room decision
   (`alloc.capacity`, emitted directly by `matcher_greedy.py`) instead of the
   disconnected FIFO queue. Verifying this against a scratch copy with *both* real
   configs simultaneously active (the multi-tenant fix from #4 made that possible for
   the first time) surfaced a separate, dormant bug: one config's `capacity: 23` tier
   (previously inert) started dominating the greedy largest-capacity-first claiming
   logic once both configs were live together, producing 23-person mega-rooms instead
   of ~37 small ones.
2. Added `MAX_EFFECTIVE_ROOM_SIZE = 6` and `expand_oversized_templates()`, splitting
   any oversized tier into multiple ceiling-sized *virtual* templates before any room
   is built from it — preserving total bed count exactly, inventing no capacity. This
   fixed the mega-room problem, but real-data verification showed room shape settling
   at mostly-6 rather than the expected 2/3/4 mix, because the ceiling-expanded virtual
   slots were still numerically larger than the legitimate small tiers and so still won
   the same greedy-largest-first race.
3. Tagged every room `is_virtual: True/False` and changed all four capacity-descending
   sort sites to sort by `(is_virtual, -capacity)` — legitimate configured tiers always
   claimed first as a whole group, ceiling-expanded virtual ones only once legitimate
   capacity is genuinely exhausted. Real-data shape returned to the expected mix — a
   live re-run against the real dataset produced 31 rooms (Triple ×11, Quad ×20, 113
   beds total), matching the admin dashboard's own room-size breakdown exactly. Also
   fixed a mislabeled `needsManualPlacement` reason discovered
   along the way: a stuck student's "hard_conflict" was being checked against the
   *entire* cross-gender unassigned pool rather than just their own gender, misreporting
   a capacity problem as a constraint conflict.

**Rationale for documenting it as a chain, not one clean fix.** Each fix was verified
against the real dataset before being called done, and that real-data verification is
exactly what surfaced the next problem — a fix that looked complete against a narrower
test (single active config) wasn't complete against the real, multi-config shape. The
chain is the honest record of how "correct" was actually established.

---

## 7. Room-size and accessibility preferences: soft, best-effort, no-preference-as-filler (one reused pattern)

**Context.** After hard constraints and multi-tenancy landed, two independent product
asks arrived: let a student request a specific room size, and let a student request a
ground-floor room for accessibility. Both are explicitly *soft* — neither should ever
block placement.

**Decision.** Both use the identical mechanism: a preference pass runs before normal
fill for the relevant capacity/floor, seeding groups *only* from students who
explicitly want that specific outcome (ranked by pairwise compatibility, never a
no-preference student as a seed), and drawing on no-preference students purely as
flexible filler for any slots the preferring students alone can't fill. Whatever the
preference pass can't satisfy falls through unchanged to the existing fill logic, then
Phase 2. Satisfaction is tracked post-hoc per placed student and surfaced on the
dashboard.

**Rationale for splitting *where* accessibility is enforced.** Room-size preference is
enforced inside the Python matching engine, because room size is something the engine
already reasons about (capacity tiers). Accessibility floor-matching is **not** — it's
enforced in `adminController.js` (Node), *after* Python returns a formed group, because
floor is real, admin-configured data that only exists in the Node layer (see the
floor-realism fix in CLAUDE.md); the Python engine has never known what floor any room
is on. Rather than threading floor data into Python for one feature, the existing
Node-side room-assignment step — which already decides which physical room a formed
group lands in — was the natural, lower-risk place to add the preference. Both features
are true no-ops against real data today (verified byte-identical), since nobody has
stated either preference yet.

---

## 8. Container registry: GHCR over Docker Hub

**Context.** CI/CD needed somewhere to push built images.

**Decision.** `ghcr.io/aditi22bansal/pbl2-{backend,frontend,python-service}`, authenticated
with the workflow's own built-in `GITHUB_TOKEN` (`packages: write` permission).

**Rationale.** Zero new secrets to create or manage. A Docker Hub push would need a
separately-created access token stored as a repo secret and rotated independently of
anything GitHub already manages; GHCR's auth is already scoped to the repository via
the token GitHub Actions provisions for every run automatically.

---

## 9. Kubernetes: a `kind` cluster, and `kubectl port-forward` over relying on NodePort

**Context.** The rolling-update/rollback demonstration needed a real cluster to deploy
to and a way to actually view the running app from a browser.

**Decision.** Deployed to a local `kind` cluster (confirmed via `kubectl
config current-context` before starting, rather than assumed). The `frontend` Service
is still declared `NodePort` in the manifest (`k8s/frontend.yaml`), but the actual live
demo used `kubectl port-forward` instead of hitting the NodePort directly.

**Rationale.** A bare local cluster (`kind`, or Docker Desktop's own K8s) has no cloud
load-balancer controller, so `type: LoadBalancer` would sit with a pending external IP
forever without extra infrastructure — `NodePort` is the right manifest choice for a
cluster that publishes it. This specific `kind` cluster, confirmed via `docker ps`,
only publishes the API server port (6443) to the host — the NodePort range isn't
reachable from outside the cluster's Docker network at all here, so
`kubectl port-forward` was what actually worked for the live demo, documented
explicitly in `docs/k8s-deployment.md` rather than silently assumed to be equivalent.
