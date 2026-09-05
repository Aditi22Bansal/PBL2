# RoomSync: Multi-Tenant + Hard-Constraint Allocation — Design Proposal

**Status:** Proposal for review. Nothing in this document has been implemented — no
application code was changed to produce it. All line references are to the codebase
as of this writing (branch `ahmad-dev`, backend REST architecture already in place:
Node → HTTP → FastAPI `/allocate/v2` → `ml_engine/executor.py`'s `compute_allocation()`).

---

## Part A — Current-state analysis

### A.1 — Data model: what assumes "there's only one hostel system"

None of the six Mongoose collections have any tenant/organization concept at all.
Every query in every controller reads from a single global pool. The concrete
places this bites:

| Collection | File | Single-tenant assumption |
|---|---|---|
| `User` | `backend/models/User.js` | `email` is globally unique (fine — stays fine under multi-tenancy, see §B.3). No org field. Role is a bare string (`'STU'`/`'ADMIN'`), not scoped to anything. |
| `Profile` | `backend/models/Profile.js` | `user_id` globally unique. No org field. Every read is `Profile.find({})` (e.g. `adminController.js:161`, `:346`, `:381`, `:561`; `analyticsService.js` throughout). |
| `RoomAllocation` | `backend/models/RoomAllocation.js` | No org field. `room_number` (e.g. `"A-102"`) is unique only by convention, not enforced — two orgs would collide on room numbers immediately. |
| `HostelConfiguration` | `backend/models/HostelConfiguration.js` | No org field. **The `isActive` exclusivity is enforced globally across the entire database**, not even per-org: `hostelConfigController.js:59` (`create`), `:107` (`update`), and `:141` (`activate`) all call `HostelConfiguration.updateMany({}, { isActive: false })` — an empty filter, matching every document in the collection regardless of who created it. |
| `ChangeRequest` | `backend/models/ChangeRequest.js` | No org field. `ChangeRequest.find({})` in `adminController.js:520`. |
| `Chat` | `backend/models/Chat.js` | No org field. Messages are scoped only by `room_id`, which itself has no org boundary. |

**A concrete, currently-live illustration of the `isActive` bug** (checked against the
running database while writing this): there are two `HostelConfiguration` documents —
`"tulip"` (Female, capacity templates `2×20, 3×40, 4×10`) and `"carnation"` (Male,
`23×200, 3×40, 4×10`) — and **both currently show `isActive: false`**. That's not a
migration artifact; it's the direct, reproducible consequence of the exclusivity logic:
activating one deactivates the other, but a real institution obviously needs a Male
config *and* a Female config active **simultaneously**. This is a bug independent of
multi-tenancy — see §B.3 for the fix, which turns out to also be the multi-tenant fix.

Also not org-scoped, and separately relevant: the Python service's legacy CSV
persistence layer (`backend/repositories/csv_repo.py`) reads/writes single flat files
(`backend/data/profiles.csv`, `allocations.csv`, etc.) — no partitioning concept
exists there either, though this path is not live traffic (see `CLAUDE.md`: the live
path is `POST /allocate/v2`, which is stateless and DB-free on the Python side).

### A.2 — Allocation engine: where do hard constraints and scoring actually interact?

Tracing the real call chain: `adminController.js:triggerAllocation` →
`allocationService.js:runPythonAllocationViaHTTP` → `POST /allocate/v2` (`main.py:460`)
→ `compute_allocation()` (`ml_engine/executor.py:14`) →
`run_greedy_allocation_for_gender()` (`ml_engine/matcher_greedy.py`), which uses
`encode_profile()` / `has_hard_conflict()` / `get_structural_penalty()` from
`ml_engine/encoder.py`.

**Gender — currently a *bucketing* boundary, not a constraint the matching engine itself knows about.**
Gender never appears in `encode_profile()`'s feature vector, and `has_hard_conflict()`
doesn't check it. Gender-safety today is a side effect of two independent, duplicated
pre-partitioning steps that both happen to split by gender before the matcher ever
runs:
- `adminController.js:206-216` manually splits into `girlsFY` / `girlsSenior` / `boysAll`
  and calls the Python service **three separate times**, once per pool.
- `compute_allocation()` (`executor.py:52`) *also* buckets by `(gender, branch,
  year_of_study)` internally — redundant when called from `adminController.js` (each
  pool it receives is already single-gender), but this means gender-safety is
  **not centralized**: if any other caller (the legacy `/api/allocate` route, or a
  future direct call) sends a mixed-gender pool straight to
  `run_greedy_allocation_for_gender()`, nothing in the matcher itself would stop two
  different genders from being greedily paired. Gender safety is real today only
  because every current caller happens to pre-partition correctly — it is not a
  property of the engine.

**Smoking / drinking — currently a *scored* feature, with a narrow, conditional hard-conflict carve-out.**
- In `encoder.py:6-22` (`WEIGHTS`), `smoking_habit` (weight 5.0, commented "Critical
  Dealbreaker") and `drinking_habit` (weight 4.0, "Dealbreaker") are ordinary features
  in the cosine-similarity vector — a mismatch lowers the score, it does not exclude
  the pairing.
- `has_hard_conflict()` (`encoder.py:98-115`) is the actual hard-constraint mechanism,
  and it *does* work as a true hard constraint where it fires: in
  `matcher_greedy.py`, any pair for which it returns `True` gets
  `sim_matrix[i, j] = -9999.0` (e.g. line 233-234, and again in
  `run_relaxed_allocation`), and every downstream step — greedy pair selection,
  candidate expansion, and local search — explicitly checks for and skips `-9999.0`
  pairs (e.g. `matcher_greedy.py:285`, `:303`, `:57`, `:123`). **This plumbing is
  exactly the right mechanism for a hard constraint — it's just under-triggered.**
  The condition only fires when `abs(smoke_score_1 - smoke_score_2) >= 3` **and**
  either student explicitly selected `"Lifestyle Habits (...)"` as their
  `most_important_factor`. A heavy smoker and a strict non-smoker who didn't happen to
  tick that specific dropdown option can and will be scored/matched normally today.
  Drinking is not checked by `has_hard_conflict()` at all — only smoking is.

**"Unassigned" is a designed, expected, reported outcome today — not a failure mode.**
- `run_greedy_allocation_for_gender()` best-effort improves and flex-fills
  (`fallback_assign_unassigned`, `create_flex_rooms` — `matcher_greedy.py`), but
  whatever's left after that is returned as `unassigned_ids` — a normal field in the
  response, not an exception.
- `compute_allocation()` reports it via `validationMetrics.unassigned_students`
  (`executor.py:127-141`) and also *already reports* the capacity-shortfall number
  explicitly: `insufficient_capacity: max(0, total_students - total_beds)`
  (`executor.py:119`) — the system *knows* when this happens, it just doesn't act on
  it beyond reporting.
- `adminController.js:triggerAllocation` returns `unassigned: allUnassigned.length`
  as a plain integer in a `200` success response (line 332) — never an error.
- There is exactly one remediation path, and it's opt-in and separately concerning:
  `adminController.js:forceAllocateRemaining` (line 551), triggered by an admin
  clicking "Force Allocate All" in `/admin/allocations`. It sorts unassigned students
  by gender/branch/year and chunks them into groups of 3
  (`adminController.js:588-624`) — **it does not call the Python engine, does not
  compute compatibility, and does not check `has_hard_conflict` at all.** A
  force-allocated room today could legally contain a smoker and a strict non-smoker.
  This is a second, independent way the current system can violate the very
  constraints the product owner now wants enforced absolutely — worth fixing as part
  of this work, not left as a separate loophole.

Live confirmation, checked against the running dataset while writing this: **116
students, 109 completed profiles, 37 rooms formed, 16 currently unassigned** — roughly
15% of completed profiles left unplaced, accepted today as a normal outcome shown in
the admin analytics dashboard.

---

## Part B — Proposed design

### B.3 — Multi-tenant data model + migration plan

**New collection: `Organization`**
```js
{
  _id: ObjectId,
  name: String,              // "Symbiosis Institute of Technology, Pune"
  slug: String,               // "sit-pune" — unique, URL-safe
  allowedEmailDomains: [String], // ["sitpune.edu.in"] — replaces the hardcoded check
  createdAt, updatedAt
}
```
Kept deliberately minimal — no billing/plan fields, no multi-domain-per-org complexity
beyond a list of allowed email domains. The product owner's requirements don't ask for
a provisioning/billing flow, so this proposal doesn't invent one; it's a natural
next step once this lands, not designed here.

**Every existing collection gets one new field: `organizationId: { type: ObjectId, ref: 'Organization', required: true, index: true }`.**
That's the whole schema change for `User`, `Profile`, `RoomAllocation`,
`HostelConfiguration`, `ChangeRequest`, `Chat`. No other field changes are required —
existing unique constraints (`User.email`, `Profile.user_id`) stay global-unique
exactly as today, since this design resolves org membership from email domain (one
person → one org), not from a composite key.

**`HostelConfiguration.isActive` — redesigned, not just scoped.**
As shown in §A.1, the current "only one active document in the whole database"
behavior is already wrong for a single real institution (it can't have both a Male and
a Female config active together, which the live data shows is exactly what's wanted).
The fix: **drop the exclusivity logic entirely.** `isActive` becomes a plain per-document
toggle, scoped only by `organizationId` implicitly (since every query is org-scoped
anyway). Remove the three `updateMany({}, { isActive: false })` calls
(`hostelConfigController.js:59,107,141`) outright — no replacement "deactivate the
others in this org" logic is needed, because multiple simultaneously-active configs
per org is the *correct* behavior, not an edge case to guard against. The allocation
engine (§B.4) then aggregates room-template inventory across **all** `isActive: true`
configs for the org, instead of assuming exactly one.

**Resolving tenant context at request time:**
- At `sync-user` time (`backend/routes/auth.js:6`), instead of the hardcoded
  `email.endsWith('@sitpune.edu.in')` check (line 16), look up
  `Organization.findOne({ allowedEmailDomains: emailDomain })`. If found, set the new
  user's `organizationId`; if not found, reject exactly as today's domain check does
  (this directly replaces the hardcoded string with a data-driven lookup — same
  UX, generalized).
- For every authenticated request thereafter, add a small Express middleware
  (new file, e.g. `backend/middleware/tenantContext.js`) that resolves
  `req.headers['x-user-email']` → `User.organizationId` → `req.organizationId`, run
  before every controller. Every controller query in the codebase today
  (`Profile.find({})`, `RoomAllocation.find({})`, `HostelConfiguration.find({})`,
  `ChangeRequest.find({})`, `Chat.find({...})`, and the analytics/conflict services'
  equivalents) gets `organizationId: req.organizationId` added to its filter. This is
  the single largest-surface-area but most mechanical part of the whole proposal —
  no query becomes more complex, they all just gain one more filter key.

**Migration plan for the real, current data (116 students / 109 profiles / 37 rooms / 2 hostel configs / 1 change request) — a backfill, not a fresh start:**
1. Insert one `Organization` document representing the current de facto tenant:
   `{ name: "Symbiosis Institute of Technology, Pune", slug: "sit-pune",
   allowedEmailDomains: ["sitpune.edu.in"] }`. Capture its `_id`.
2. Add `organizationId` to all six schemas as **optional** first (not `required`) —
   this is the safe order: code that doesn't yet set it won't start failing writes
   mid-rollout.
3. Run a one-time backfill script, one `updateMany` per collection:
   `db.<collection>.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: SIT_PUNE_ORG_ID } })`
   for `users`, `profiles`, `hostelconfigurations`, `roomallocations`,
   `changerequests`, `chats`. Nothing about the *values* of existing documents
   changes — this only stamps ownership onto records that already exist correctly.
4. Verify: a `countDocuments({ organizationId: { $exists: false } })` of `0` across
   all six collections before proceeding.
5. Only then flip `organizationId` to `required: true` in each schema, and only then
   deploy the middleware + query-scoping changes from the previous section. Until
   step 5, the app continues running exactly as it does today — this migration is
   fully backward-compatible up to that point, which is what makes it safe to run
   against the live 116-student dataset without downtime.

### B.4 — Hard-constraint allocation algorithm

**Principle:** gender, smoking, and drinking become absolute pre-filters that partition
the candidate space *before* any compatibility scoring happens — never a scoring
input, never something a high compatibility score can outweigh. Compatibility scoring
becomes purely the objective function applied *within* whatever the pre-filters allow.

1. **Gender** — stop the duplicated, drift-prone bucketing. Delete the manual
   `girlsFY`/`girlsSenior`/`boysAll` split in `adminController.js:206-216`; send the
   full org profile list to `/allocate/v2` in **one** call. `compute_allocation()`
   becomes the single, sole place gender partitioning happens (it already does this
   correctly at `executor.py:52`, bucketing by `(gender, branch, year_of_study)` — the
   fix is removing the *second*, redundant implementation, not adding a new one).
   Add one explicit runtime invariant as defense-in-depth, since this is a "must never
   violate" constraint, not a "should usually hold" one: after any room is formed,
   assert `len({p.gender for p in room_members}) == 1` and refuse to emit that room
   (raise, don't silently accept) if it's violated. A single centralized assertion is
   cheap insurance against a future code change silently reintroducing a mixed-gender
   room.
2. **Smoking / drinking** — broaden `has_hard_conflict()` (`encoder.py:98`) to fire
   unconditionally whenever habits are incompatible (e.g. one is a regular
   smoker/drinker and the other is a firm non-smoker/non-drinker), removing the
   `most_important_factor` gate entirely. The existing `-9999.0` sim-matrix mechanism
   and the skip-checks already wired through `matcher_greedy.py` need no structural
   change — they already do the right thing once the trigger condition is correct.
   Remove `smoking_habit` and `drinking_habit` from `encode_profile()`'s scored
   `WEIGHTS` (`encoder.py:10-11`) once they're unconditional hard filters — scoring
   *and* hard-filtering the same dimension is redundant and just wastes weight budget
   that could go to genuinely negotiable preferences (sleep schedule, cleanliness,
   etc.).
3. **Retire the score-threshold rejections that currently cause "unassigned."** Today,
   a candidate group is thrown away if `avg_score < 0.70` (main matching pass) or
   `< 0.30` (relaxed pass) — `matcher_greedy.py`. Under a 100%-placement guarantee,
   rejecting a room for being low-scoring and then leaving those students unassigned
   is a direct contradiction. These thresholds can still influence **ordering**
   (attempt higher-scoring groupings first — that's the existing greedy sort by
   descending similarity, which stays), but must stop being a hard rejection gate.
4. **Two-phase allocation, to make 100%-placement an actual guarantee instead of a
   best-effort:**
   - **Phase 1 (optimize):** run today's greedy + local-search compatibility
     maximization, constrained by the gender partition and the hard-conflict
     sim-matrix poisoning from steps 1-2. This is exactly the existing algorithm,
     just correctly constrained and without the reject-on-low-score behavior from
     step 3.
   - **Phase 2 (guarantee):** for anyone Phase 1 didn't place, iterate them one at a
     time within their gender bucket. For each, look for an existing under-capacity
     room with **zero** hard-conflict against its current occupants (there may be
     several candidates — pick the best-compatibility one, same objective as Phase 1,
     just operating on individuals against existing rooms rather than group formation
     from scratch). If no existing room qualifies, open a new room from any remaining
     template capacity. This phase replaces `forceAllocateRemaining`'s current
     sort-and-chunk logic (`adminController.js:551-639`), which — as noted in §A.2 —
     doesn't check hard conflicts at all today. Phase 2 must run through the same
     `has_hard_conflict()` check Phase 1 uses; there is no "force" path that bypasses
     hard constraints under this design.
   - **The named edge case — what if even Phase 2 can't find a legal room for
     someone** (e.g., the last two remaining students of one gender are a committed
     smoker and a committed non-smoker, and every existing room is either full or
     would force them together)? Since the product owner has stated both "100%
     placed" and "hard constraints never violated" as absolutely non-negotiable, and
     those two requirements can directly conflict at the margin, the only remaining
     lever is **capacity** — it must flex as the deliberate last resort. Phase 2 is
     authorized to open an **overflow room** outside the normal template inventory
     (capacity beyond what was configured) rather than either leaving someone
     unassigned or forcing a hard-conflict pairing. This must never happen silently:
     the allocation response needs an explicit `overflowRooms` list (new field, see
     §B.5) so an admin can see exactly which rooms exceeded configured capacity and
     why, and act on it (e.g. add more room inventory before the next run).
   - **The other named edge case — an org's total configured capacity is simply less
     than its student count** (`total_beds < total_students`, already computed today
     as `insufficient_capacity` at `executor.py:119` but currently just reported, not
     acted on). This is categorically different from the constraint-driven shortfall
     above — no amount of overflow-room cleverness fixes "you configured 90 beds for
     116 students." This must be a **pre-flight check that blocks the allocation
     entirely** before any matching runs, returning a clear error (see §B.5) telling
     the admin exactly how many more beds are needed, rather than attempting an
     allocation that is mathematically guaranteed to fail 100%-placement. Silently
     overflowing every room to compensate for a genuine capacity shortfall would
     produce a nonsensical result (rooms with 2-3x their configured capacity); asking
     the admin to fix the inventory first is the right UX.

**A noted alternative, not recommended for this phase:** the above is an incremental
extension of the existing greedy + local-search heuristic — the right choice given the
"no big-bang rewrite" constraint, since it reuses the current algorithm's structure and
is verifiable against the real dataset immediately. A more formally rigorous
alternative would be to reformulate this as a constraint-satisfaction / integer
programming problem (e.g. via Google OR-Tools CP-SAT: hard constraints as boolean
constraints, "every student assigned" as a hard constraint on the model itself rather
than a fallback phase, compatibility sum as the maximized objective) — this would give
mathematically provable guarantees instead of heuristic ones, at the cost of replacing
the matching core rather than extending it. Worth revisiting once multi-tenancy is live
and real problem sizes/org counts are known, but out of scope for this incremental
proposal.

### B.5 — API layer & REST contract changes

**Node backend (`adminController.js` and friends):**
- `triggerAllocation`: remove the manual gender pre-split (§B.4.1); resolve
  `organizationId` from the tenant-context middleware (§B.3); aggregate
  `roomTemplates` across **all** `isActive: true` `HostelConfiguration` docs for that
  org (not one); send one request to `/allocate/v2`.
- **Critical bug to fix as part of this work, not after:** `syncCsv`
  (`adminController.js:129`) currently does `Profile.deleteMany({})` — an
  **unscoped, global wipe of every organization's profiles** on every sync. Under
  multi-tenancy this must become `Profile.deleteMany({ organizationId: req.organizationId })`,
  or the first sync by any org's admin deletes every other org's student data. This
  is not a hypothetical edge case — it's the literal current behavior of a
  frequently-used admin action.
- Every controller query gains `organizationId` scoping, per §B.3.

**`/allocate/v2` request contract (`main.py`'s `AllocateV2Request`) — add:**
```python
class AllocateV2Request(BaseModel):
    profiles: List[Dict]
    config: Optional[Dict] = None
    organizationId: Optional[str] = None   # echoed back for logging/traceability only —
                                             # the Python service stays DB-free/stateless,
                                             # it doesn't look anything up by this
    constraints: Optional[Dict] = None      # e.g. {"noMixedGender": true,
                                             #        "smokingHardConflict": true,
                                             #        "drinkingHardConflict": true}
                                             # explicit, versioned policy — not hardcoded
                                             # in Python — defaults to all-true (the
                                             # non-negotiable defaults) if omitted
```
Making the constraint policy an explicit part of the request (rather than baked
directly into Python logic with no way to inspect what was requested) keeps the Node
layer as the one place that decides and can audit what policy was in effect for a
given run, and keeps the constraint logic in Python unit-testable per-flag in
isolation.

**`/allocate/v2` response contract — the shape of "unassigned" must change:**
```python
{
  "allocations": [...],
  "overflowRooms": [...],       # NEW — rooms placed above configured capacity (Phase 2 last resort)
  "capacityShortfall": null,    # NEW — {"needed": N, "available": M} ONLY when the
                                 # pre-flight check rejects the whole request
  # "unassigned_ids" is retired from the success path entirely — under this design,
  # a 200 response always means everyone got placed. A capacity shortfall becomes a
  # 422 rejection (with capacityShortfall populated) rather than a 200 with leftovers.
  "metrics": {...},
  "run_id": "...",
  "status": "COMPLETED"
}
```
`adminController.js`'s response to the frontend follows the same shape change —
`unassigned: N` stops being a normal field in a successful trigger-allocation
response; the admin UI's "Unassigned Students" panel and "Force Allocate All" button
(`frontend/src/app/admin/allocations/page.tsx`) become unnecessary under a true
100%-placement guarantee and would be removed in favor of an "Overflow Rooms" panel
surfacing `overflowRooms` instead — a UI change, not designed in detail here since this
document is backend/algorithm-focused, but noted so the two stay consistent.

### B.6 — Hardcoded SIT-Pune / single-tenant checklist (for later, not fixed now)

| Location | What's hardcoded |
|---|---|
| `backend/routes/auth.js:14-16` | `@sitpune.edu.in` domain check gating user sync |
| `frontend/src/app/api/auth/[...nextauth]/route.ts:48,71` | Same domain check, client-side auth flow (Google provider + demo bypass) |
| `frontend/src/app/unauthorized/page.tsx:13` | "This system is restricted to @sitpune.edu.in accounts" copy |
| `frontend/src/app/login/page.tsx:373,400` | Placeholder `student0@sitpune.edu.in`, "Restricted to @sitpune.edu.in Domains" copy |
| `frontend/src/app/register/page.tsx:128,159` | "...administrator at SIT Pune...", "Restricted to @sitpune.edu.in accounts" |
| `frontend/src/app/layout.tsx:6-7` | Page `<title>`/description: "SIT Pune Hostel Room Allocation" |
| `frontend/src/app/page.tsx:273,276,499,534` | Landing-page marketing copy naming "SIT Pune" and a named researcher/testimonial |
| `frontend/src/app/admin/allocations/page.tsx:141,205` | PDF report header/footer text: "SIT Pune — Hostel Room Allocation Report" |
| `backend/controllers/adminController.js:53` | Fallback synthetic email `student_${index}@sitpune.edu.in` when a CSV row has no email column |
| `backend/repositories/csv_repo.py:95` | Same fallback pattern, legacy CSV path |
| `backend/main.py:16` | FastAPI app title: `"SIT Pune Hostel Allocator"` |
| `frontend/src/lib/questionnaireConfig.ts:71` | Branch dropdown hardcoded to `["CSE", "AIML", "RNA", "MECHANICAL", "ENTC", "CIVIL"]` — SIT Pune's actual department list, not configurable per org |
| `frontend/src/app/admin/page.tsx` (`sheetUrl` initial state) | Default Google Sheet sync URL pre-filled to a specific SIT Pune sheet |
| `adminController.js:234-236,249,256-260,287-289` | Hardcoded block-letter room-numbering scheme (`A-G`, fixed floor/room math, fixed allocation of blocks A/B-C/D-G to the three gender pools) — entirely disconnected from `HostelConfiguration`, which has no concept of "blocks" at all. Not SIT-Pune-*named*, but a structural single-institution assumption: room numbering doesn't derive from any org's actual configured inventory shape today. |

None of these need to change for the backend/algorithm work in §B.3-B.5 to land — they're
a follow-on UI/copy/config pass once an org actually needs to onboard with a different
domain, branch list, or building-naming scheme.

---

## Part C — Sequencing

**Recommended order — hard constraints first, fully before multi-tenancy, then
tenant-scoping, then UI/copy cleanup last.**

1. **Hard-constraint allocation engine (§B.4)** — `encoder.py`, `matcher_greedy.py`,
   `executor.py`, and the `triggerAllocation` de-duplication in `adminController.js`.
2. **Data model migration (§B.3)** — `Organization` collection + backfilled
   `organizationId` across the six collections, deployed as optional-then-required per
   the two-step migration above.
3. **API-layer tenant scoping (§B.5)** — auth middleware, every controller query
   gaining `organizationId`, the `syncCsv` global-wipe fix, retiring
   `HostelConfiguration`'s exclusivity logic.
4. **Frontend/UX + hardcoded-copy checklist (§B.6)** — last, cosmetic/config-surface
   work that naturally follows once the backend actually supports more than one org.

**Why this order, specifically:**

- **Step 1 requires zero schema changes and zero concept of "organization."** It only
  changes *how* the one existing pool of profiles gets allocated — it's a pure
  algorithm/orchestration fix. Because of that, it's fully backward-compatible: the
  current single-tenant deployment keeps working exactly as it does today, just
  correctly constrained, and it can be verified immediately against the real
  116-student / 37-room live dataset without touching the database shape at all. This
  is the highest-value, lowest-risk step to do first — it's also the step the product
  owner's requirements describe most urgently (constraints "must NEVER be violated").
- **Step 2 is next, ahead of step 3, because it's a pure, mechanical, reversible data
  migration with no behavior change** (per the two-phase optional-then-required
  rollout in §B.3) — it can be run, verified, and left in place with the app
  behaving identically, *before* anything starts actually depending on the new field.
  Doing it before step 3 means step 3's query-scoping work has a real field to scope
  against from day one instead of being developed against a hypothetical schema.
- **Step 3 is the largest-surface-area step (touches nearly every controller
  function) but the lowest-complexity-per-touch** (each change is "add one filter
  key") — it's naturally suited to being done file-by-file and tested incrementally,
  optionally behind a flag that defaults every request's `organizationId` to the
  migrated SIT Pune org when unset, so the live deployment never has a moment where
  it's broken mid-rollout.
- **Step 4 last**, because it's the least risky and most cosmetic, and genuinely
  depends on the backend already supporting a second org before there's anything real
  to build an org-switcher or domain-configurable branch list against.

This ordering means the single most product-critical fix (constraints that must never
be violated, 100% placement) ships first and independently, without waiting on the
comparatively large multi-tenant plumbing effort — and multi-tenancy, once it lands,
inherits an allocation engine that's already correct rather than needing to be
re-verified against two moving pieces at once.
