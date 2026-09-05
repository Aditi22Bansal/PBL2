# DevOps Reflection Report

**Project:** RoomSync — hostel roommate-allocation platform
**Track:** CI/CD, containers/Kubernetes, configuration management, monitoring

This is a reflection on the DevOps work layered onto RoomSync alongside its evolution
from a single-institution BTech project into a multi-tenant SaaS. The two tracks
turned out to be more intertwined than I expected going in — decisions made for the
product (the REST microservice split, multi-tenant data isolation, real
authentication) repeatedly became the thing that made the DevOps rubric items
possible, or the thing that broke first when a DevOps step exposed a gap the product
work had left behind.

## What was actually built

In sequence: a subprocess-spawn-to-REST refactor that gave the Python allocation
engine a genuine service boundary; Docker + Docker Compose for local development;
GitHub Actions CI/CD (lint, build, and push real images to GHCR); Kubernetes manifests
deploying those images to a local `kind` cluster with a demonstrated rolling update
and rollback; an Ansible playbook provisioning a target host from nothing and
deploying the same CI-built images; and finally Prometheus + Grafana monitoring the
two instrumented backend services with a real, traffic-verified dashboard. Each stage
is documented in its own doc — [docs/ci-pipeline.md](ci-pipeline.md),
[docs/k8s-deployment.md](k8s-deployment.md),
[docs/ansible-deployment.md](ansible-deployment.md),
[docs/monitoring.md](monitoring.md) — and the engineering reasoning behind the
significant choices is in [docs/decisions.md](decisions.md). This report is the
reflective layer on top of all of that: what the process of building it actually
taught me, not a second copy of what's already written down elsewhere.

## What I learned

### A pipeline only proves what it actually checks

The CI pipeline's lint jobs are honest about their own limits — "syntax-check, no
real lint script exists yet" for the backend, `py_compile` sanity checks instead of a
real linter for the Python service. It would have been easy to write a green checkmark
that quietly checked nothing. The value of the pipeline came from what it *did*
verify for real: that every Dockerfile actually builds, and that the images that get
pushed are the same ones a `docker build` locally would produce. I'd rather have a
pipeline that's honest about doing three real things than one that looks more
impressive and does one.

### Containerizing an app finds bugs the app's own tests never would

The single most useful thing Kubernetes did for this project wasn't the rolling
update or the rollback demo — it was forcing every environment variable the app
depends on into the open. A shared ConfigMap's `PORT=5000` (meant only for the
backend) silently leaked into the frontend pod too via a shared `envFrom`, overriding
the frontend image's own baked-in `PORT=3000` default and leaving it listening on the
wrong port entirely — invisible until a liveness probe expecting port 3000 started
killing a pod that was, from its own perspective, working perfectly. That's exactly
the kind of bug that never surfaces in local development, where every service just
reads its own `.env` file and nobody notices a "shared" config value was never
actually service-specific to begin with. Multi-tenancy work surfaced something similar from a different
angle: only once two hostel configurations were simultaneously active (which
multi-tenancy made possible for the first time) did a dormant capacity-tier bug turn
into visible 23-person mega-rooms. Both bugs existed in the code long before either
task started; both needed a real environment change to become visible at all.

### "Verify" has to mean "check the thing that could be wrong," not "confirm the thing I expect"

The habit that mattered most across every one of these tasks was treating a green
result with suspicion until it was checked from an angle that could have caught a
problem. A browser screenshot looking right isn't proof a Kubernetes rollback worked —
a stale `kubectl port-forward` silently serving a dead pod's last response, or an
old local dev server squatting on a freed port, produces an identical-looking
screenshot to a genuine success. The fix wasn't "be more careful" in the abstract; it
was concrete: cross-check the pod image `kubectl` actually reports against a raw
`curl` response, independent of whatever the browser is showing. The same discipline
showed up in the monitoring work in a quieter way — an empty or all-zero Grafana
dashboard proves a ConfigMap parsed, nothing more. Only real, generated traffic
(including deliberately triggering genuine 401s and 404s, not just happy-path 200s)
turns a "the panels render" screenshot into "the panels show something true."

### Infrastructure has real, physical failure modes that application code doesn't

Building the Ansible task's two-container demo hit a Docker Desktop/WSL crash mid-build,
traced to the host disk being nearly full — not a bug in any playbook or Dockerfile,
just physical resource pressure that any purely-local, non-containerized development
workflow would never have surfaced, because nothing before this pushed disk I/O and
image-layer storage hard enough to matter. Recovering from it meant learning to
distinguish "did my change break this" from "did the platform break under my change" —
checking `kubectl get nodes` and every existing pod's health *before* assuming a
crashed Docker daemon meant lost work, rather than either panicking or blindly
retrying.

### A working demo and a working *deployment* aren't the same claim

Deploying the exact GHCR-built frontend image via Ansible on deliberately different
host ports than its own CI build had used surfaced something I hadn't fully
appreciated: `NEXT_PUBLIC_API_URL` is baked into that image's client JavaScript at
*build* time, permanently, and no environment variable at deploy time can change it.
Login and both dashboards worked perfectly — because those paths run through a
server-side proxy using the internal Docker network, unaffected by which host port
anything publishes on. But Socket.IO and the org-registration page call that baked-in
URL directly from the browser, and on different ports, they simply couldn't reach the
right backend. Neither is a bug in the Ansible playbook; it's a property of the image
itself that only a real, differently-configured deployment would ever expose. It was
a genuinely useful lesson in reading a container image as a specific, frozen
artifact — not just "the app," but a particular build's particular baked-in
assumptions.

### Security work and DevOps work are the same discipline aimed at different failure modes

The admin-routes-with-zero-authentication and client-controlled-role-escalation
vulnerabilities documented in [SECURITY.md](../SECURITY.md) weren't found by a
scanner or a rubric requirement — they were found by asking the same question the
DevOps verification work kept asking: "what does this actually check, versus what do
I assume it checks?" An admin route with no `requireAuth` middleware "worked" in
every manual test, right up until someone asked what happens with no session at all.
That's the same failure shape as a Grafana panel that renders with zero data, or a
browser screenshot pointed at a stale pod — a thing that *looks* like proof but isn't,
because the case that would have disproven it was never actually tried.

## What I'd do differently

- **Instrument earlier, not last.** Monitoring landed at the very end of the
  sequence, which meant every earlier bug (the ConfigMap collision, the room-capacity
  issues, the port-forward staleness) was diagnosed by hand — reading logs, comparing
  screenshots, manually curling endpoints — instead of by looking at a dashboard that
  already existed. A histogram of request latency and an error-rate panel would have
  made several of these bugs visible in seconds rather than requiring a dedicated
  investigation each time.
- **Treat "the socket is mounted" and "the socket is usable by this user" as two
  separate facts to verify**, not one. The Docker-outside-of-Docker permission
  alignment in the Ansible task (discovering the mounted socket's actual GID rather
  than assuming the freshly-created local `docker` group would just work) is a
  pattern I now apply by default rather than as an afterthought once something failed.
- **Budget real time for infrastructure to just break.** A disk-space-triggered WSL
  crash and a stale-port-forward mixup were each individually minor, but neither was
  something a plan built purely around application-level task steps accounted for.

## Closing note

The product side of this project (multi-tenancy, the hard-constraint allocation
engine, real authentication) and the DevOps side (CI/CD, containers, configuration
management, monitoring) are documented separately because they're separate
deliverables, but in practice neither was ever really separable from the other. The
DevOps work kept finding real product bugs by changing the environment around the
app; the product's own security and multi-tenancy fixes kept becoming the thing that
made the next DevOps step (a real deployment target, a real dashboard with real
traffic) possible or meaningful in the first place. That connection — infrastructure
work as a way of testing the application under conditions its own test suite never
creates — is the single biggest thing I'm taking away from this.
