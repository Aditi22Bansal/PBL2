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

## Product direction (in progress, not yet built)
Target: multi-tenant B2B SaaS. Hard constraints the allocation engine must NEVER violate: 
no mixed-gender rooms, no smoking/alcohol incompatibility, 100% of students must be 
allocated a room (nobody left unassigned). Compatibility score is maximized WITHIN those 
constraints, not traded off against them. NOT yet implemented — current engine treats 
compatibility as primary without a hard-constraint layer.

## DevOps rubric being satisfied alongside this project
CI/CD pipeline (GitHub Actions), config management (Ansible/Puppet), containers + 
Kubernetes (rolling update/rollback demo), monitoring (Prometheus+Grafana), reflection 
report. No fixed deadline. Sequencing so far: REST refactor (done) → Docker (done) → 
CI/CD (next) → K8s → Ansible → monitoring → report.

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
- Duplicate room_number values are possible: adminController.js numbers rooms within-floor 
  as `(count % ROOMS_PER_FLOOR) + 1` (ROOMS_PER_FLOOR=8), keyed by (block, floor). Since 
  every male room is block D regardless of branch/year, a single (D, Ground) bucket can 
  exceed 8 rooms in one run (confirmed: 22 in the real 109-profile dataset), wrapping the 
  counter and producing e.g. multiple rooms named "D-G01". Pre-existing since the 
  floor-realism work, not introduced or worsened by the block-lettering cleanup below - 
  surfaced while verifying it. Root cause is the same gap noted in the backlog below (no 
  real per-block capacity anywhere in the data model); fixing it for real means building 
  that, not just bumping ROOMS_PER_FLOOR.

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
