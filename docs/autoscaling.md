# Autoscaling: python-service

Horizontal Pod Autoscaling for the one service actually worth autoscaling, with a real
load test proving the scale-up/scale-down is genuine — not just a manifest that was
never exercised. Ties directly back to [docs/decisions.md](decisions.md) #1, which
moved the allocation engine to a real REST microservice specifically "for independent
scaling" — this is that claim, tested for real, four months(ish) after the fact.

## Why python-service, not backend/frontend

`backend` and `frontend` are mostly I/O-bound (Mongo queries, proxying, rendering).
`python-service` is the one CPU-bound hot spot in the whole system —
`ml_engine/matcher_greedy.py`'s cosine-similarity scoring and greedy + local-search
matching genuinely burns CPU proportional to the profile count, and it's already a
separate, stateless microservice (see [Statelessness](#confirming-python-service-is-genuinely-stateless)
below) — the only one of the three where "just add replicas" is both meaningful and
safe.

## metrics-server: already present, confirmed working

Checked before assuming anything needed installing:

```
$ kubectl get deployment metrics-server -n kube-system
NAME             READY   UP-TO-DATE   AVAILABLE   AGE
metrics-server   1/1     1            1           19d
```

Already running — turned out to date back to the `social-media` lab exercise's own
HPA (`horizontalpodautoscaler.autoscaling/social-media-hpa`), a pre-existing namespace
on this shared `devops-lab` cluster that a separate cleanup task later removed. Its
args already carry the well-known kind-specific flag kind clusters need
(`kubelet-insecure-tls`, since kind's kubelets don't present a cert
metrics-server's default trust chain would accept):

```
$ kubectl get deployment metrics-server -n kube-system -o jsonpath='{.spec.template.spec.containers[0].args}'
["--cert-dir=/tmp","--secure-port=10250","--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname","--kubelet-use-node-status-port","--metric-resolution=15s","--kubelet-insecure-tls"]
```

Proof it's not just "deployed" but actually working — `kubectl top` returning real,
non-placeholder numbers:

```
$ kubectl top nodes
NAME                       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
devops-lab-control-plane   70m          0%       1261Mi          18%

$ kubectl top pods -n roomsync
NAME                              CPU(cores)   MEMORY(bytes)
backend-...                       12m          34Mi
frontend-...                      2m           46Mi
mongo-...                         106m         85Mi
python-service-...                2m           128Mi
```

That last line — `python-service` idle at **~2m CPU / ~128Mi memory** once startup
settled (an initial reading taken right after pod creation showed a 268m spike, pure
FastAPI/uvicorn/prometheus-instrumentator startup cost, not a real idle number) — is
the real baseline the resource requests below were sized against.

## Resources: absent before, added to python-service only

`kubectl get -o yaml` on both `k8s/backend.yaml` and `k8s/python-service.yaml` before
this work showed neither container had a `resources:` block at all — HPA cannot
compute a percentage without a CPU *request* to measure against, so this was a hard
blocker, not an optional tidy-up. Added to `python-service.yaml` only (backend.yaml is
noted here for the record, per the investigation this doc's methodology called for,
but is genuinely out of scope — it isn't the service this task is about scaling):

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

Sized off the real idle measurement above: the 250m request is deliberately well above
the ~2m idle floor (a request near-equal to idle usage would make the HPA's percentage
math nearly meaningless — everything would look like 100%+ utilization at the faintest
real load), and the 512Mi limit gives comfortable headroom above the ~128-165Mi
actually observed, including under the load test below.

## Confirming python-service is genuinely stateless

Before trusting horizontal scaling at all: grepped `backend/main.py` and every
`ml_engine/*.py` file for module-level mutable state that would behave differently
across replicas or concurrent requests.

- `main.py`'s only module-level values are config constants read once at process
  startup (`ALLOWED_ORIGINS`, `INTERNAL_SERVICE_KEY`, `_EXEMPT_PATHS`,
  `_ALLOWED_SHEET_HOSTS`) — never mutated per-request.
- `matcher_greedy.py` does declare three module-level lists (`ALL_SCORES`,
  `ALL_RANDOM_SCORES`, `ALL_COVERAGES`) — checked whether anything appends to them
  (which would be a real cross-request/cross-replica bug); nothing in the file ever
  does. Dead code, not live state.
- `/allocate/v2` (`main.py`) receives the full profile list and config in the request
  body and returns the computed allocation directly — no database read/write from
  python-service itself (confirmed by `docs/architecture.md`'s own description, and by
  the actual code: no `pymongo`/Mongoose-equivalent import anywhere in `main.py` or
  `ml_engine/`). Every request is a pure function of its own body.
- No local file writes on the live `/allocate/v2` path (`CSVRepository` is imported for
  the legacy CLI path only, per `main.py`'s own docstring on the v2 route).

Confirmed stateless — safe to run N replicas behind the existing ClusterIP `Service`,
which already load-balances across however many endpoints exist, with zero application
code changes needed.

## HorizontalPodAutoscaler

Added as a third resource in `k8s/python-service.yaml` (same file as its
Deployment/Service, following this repo's existing one-file-per-component convention —
not a separate `k8s/monitoring/`-style directory, since this HPA belongs to `roomsync`,
not the cross-cutting `monitoring` namespace):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: python-service
  namespace: roomsync
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: python-service
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 55
```

Applied and confirmed reading real metrics within seconds — not stuck on `<unknown>`:

```
$ kubectl get hpa python-service -n roomsync
NAME             REFERENCE                   TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
python-service   Deployment/python-service   cpu: 1%/55%   1         5         1          32s
```

## Load test methodology

**Tool: k6**, via its official `grafana/k6` Docker image — no local install needed, and
running it as a real Kubernetes `Job` **inside** the `roomsync` namespace was a
deliberate choice over `kubectl port-forward` from the host: port-forward proxies a
single connection to a single pod rather than round-robining through the Service the
way real traffic does, and this project has already hit real port-forward reliability
problems mid-demo before (see [docs/k8s-deployment.md](k8s-deployment.md)). Running the
generator inside the cluster, hitting `http://python-service:8000/allocate/v2` by its
real Service DNS name, exercises exactly the same path and load-balancing the Node
backend itself uses.

**Direct-to-python-service, not through the Node backend's `trigger-allocation`
route** — deliberately, to isolate the variable under test. Going through the backend
would also load Mongo and Express, muddying which service's CPU pressure is actually
driving the HPA; hitting `/allocate/v2` directly stresses only the service this whole
exercise is about.

**Payload**: 40 constant VUs (`k8s/load-test/allocate-load-test.js`), each iteration
posting 300 synthetic profiles (real field shapes matching
`backend/tests/conftest.py`'s fixture, deliberately more varied and about 2.6x larger
than the real ~116-profile dataset, to make each call genuinely CPU-heavy rather than
instant) with no `config` (defaults to `room_capacity: 3`, which always provisions
exactly enough beds for however many profiles are sent — no `capacityShortfall`
rejections to worry about). Sustained for 6 minutes. Script and Job manifest committed
at `k8s/load-test/` for reproducibility.

## Evidence: idle → scale-up → sustained → scale-down

Polled `kubectl get hpa python-service -n roomsync` and `kubectl top pods -n roomsync`
every 15 seconds for the full run. Key moments (all times the same session, HH:MM:SS):

| Time | Replicas | CPU (HPA) | What's happening |
|---|---|---|---|
| — (baseline) | 1 | 1%/55% | Idle, right after HPA applied |
| ~+1 min into load | 2 | `<unknown>`→scaling | First scale-up decision, one pod already at its 500m limit |
| 23:51:22 | **5** (ceiling) | **150%/55%** | Maxed out at `maxReplicas: 5` — CPU still 2.7x target even at the ceiling |
| 23:51:37 – 23:54:57 | 5 (steady) | 117–120%/55% | Sustained plateau for ~3.5 minutes under continuous load |
| 23:55:12 | 5 | 53%/55% | Load easing — k6's 6-minute duration ending |
| 23:55:28 – 23:59:54 | 5 (holding) | 0–4%/55% | CPU already idle, but replica count held — the scale-down stabilization window |
| 00:00:25 | **1** | 2%/55% | Scale-down confirmed complete |
| 00:00:25 – 00:01:29 | 1 (steady) | 1–2%/55% | Back to idle baseline, no oscillation back up |

**Scale-up was real and fast**: within roughly 2.5 minutes of sustained load, replicas
went 1 → 2 → 5, capped correctly at the configured ceiling (CPU stayed pinned at
117-150% against a 55% target the whole time it was maxed — proof `maxReplicas: 5`
is a real ceiling, not a number that happened to be high enough).

**Scale-down was real and matched the textbook default**: CPU crossed back under target
around 23:55:20; replica count didn't actually drop to 1 until 00:00:25 — almost
exactly 5 minutes later, matching Kubernetes' default HPA scale-down stabilization
window (300s) precisely. It did not oscillate back up afterward (steady at 1 replica
for the rest of the observation window) — this is a real cooldown, not a fluke or a
scale-up-forever bug.

**One honest nuance, not smoothed over**: during the sustained plateau, only 3 of the 5
running pods were ever observed near their 500m CPU limit at any given sample; the
other 2 stayed near-idle (single-digit millicores) the entire time. This is a real
property of how the load was generated, not of the HPA or the Service: each of k6's 40
VUs holds one persistent HTTP connection for its whole run, and `kube-proxy` picks a
backing pod per *connection*, not per *request* — so which of the (then-existing) pods
each VU's long-lived connection landed on was fixed early and never rebalanced across
newly-created replicas mid-run. A real admin triggering an allocation is one request
per action, not 40 concurrent long-lived connections, so this specific imbalance is a
load-test-methodology artifact, not a production concern — flagged here rather than
implied to be a perfectly even split it wasn't.

## Correctness under load and after scaling

k6's own per-request checks (`status is 200` and a parsed `allocations` field present)
passed on **3818 of 3851 requests (99.14%)** across the full 6-minute run, including
throughout the entire scale-up/plateau/scale-down cycle. The 33 failures (0.85%) were
concentrated in the final ~2 seconds of the run, as k6's `constant-vus` executor tore
down VUs at the 6-minute mark mid-request — a load-test teardown artifact, not a
correctness or reliability failure of python-service itself.

A separate, manually-inspectable check after the run (4 profiles, sent via
`kubectl exec` into the `backend` pod so the real `INTERNAL_SERVICE_KEY` header could be
attached, hitting the same scaled `python-service` Deployment) confirmed the *content*
of a response, not just its shape: 2 males roomed together (`compatibility_score: 1`),
1 female placed alone, and the 4th profile (a smoker) correctly reported in
`needsManualPlacement` with `blocking_constraint: "hard_conflict"` against the one
non-smoking female already placed — the exact hard-constraint behavior documented in
[docs/decisions.md](decisions.md) #2, still correctly enforced on the same code path
that had just absorbed 6 minutes of sustained concurrent load. Scaling did not trade
correctness for throughput.

## Does the "REST for independent scaling" bet from decisions.md #1 hold up?

**Yes — genuinely, not just on paper.** The original decision moved the allocation
engine off a spawned subprocess and onto a real HTTP boundary specifically so it could
be operated independently of the Node backend. This exercise is the first time that
independence was actually tested under real load, and it held:

- `python-service` scaled 1 → 5 replicas in response to real, sustained CPU pressure,
  entirely on its own — `backend`, `frontend`, and `mongo` stayed at exactly 1 pod each
  throughout, untouched and unaffected, confirmed by `kubectl get pods -n roomsync`
  across the whole run.
- That independence is a direct, structural consequence of the subprocess→REST
  refactor: a still-spawned-subprocess design would have tied the allocation engine's
  lifecycle to the Node process 1:1, making "scale just the CPU-bound part" impossible
  without also multiplying `backend` pods (and their Mongo connections, Socket.IO
  state, etc.) for no reason.
- The stateless design that refactor also produced (see
  [Confirming statelessness](#confirming-python-service-is-genuinely-stateless) above)
  is *why* scaling out was safe to do at all with zero code changes — a design that had
  accumulated any per-instance in-memory state would have needed real engineering work
  before this HPA could exist safely, not just a manifest addition.
- Correctness was preserved throughout — the two properties (scaling and correctness)
  didn't trade off against each other.

The one caveat worth being honest about: this proves the *mechanism* works correctly
under a sustained-concurrency synthetic load. Real production traffic against this
specific project — an admin clicking "trigger allocation" — is bursty and low-volume
(one request per org, occasionally), not 40 concurrent long-lived connections; the
uneven per-pod load distribution noted above is a property of *this load test's shape*,
not evidence against the architecture. For RoomSync's actual real-world traffic
pattern, this HPA is more a demonstrated capability than a load this specific app will
routinely hit — but the point of the original architectural bet was exactly that
capability existing when it's needed, and it does.
