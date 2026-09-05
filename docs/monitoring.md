# Monitoring

Prometheus + Grafana, deployed as plain Kubernetes manifests (no Helm — consistent
with the hand-written approach in [k8s/](../k8s/)), scraping real metrics emitted by
the actual `backend` and `python-service` deployments from
[docs/k8s-deployment.md](k8s-deployment.md) — not a synthetic demo target.

## What was instrumented, and why

Neither service had any metrics endpoint or Prometheus client library before this —
confirmed by grepping `backend/package.json`/`server.js` and
`backend/requirements.txt`/`main.py` directly rather than assumed.

- **`backend`** (Node/Express): [`prom-client`](https://github.com/siimon/prom-client),
  wired in `server.js` as middleware that wraps **every** request —
  `collectDefaultMetrics()` for process/Node-internal metrics, plus a real
  `http_request_duration_seconds` histogram and `http_requests_total` counter, both
  labeled by `method`, `route` (the matched Express route *pattern*, e.g.
  `/api/admin/profile/:id` — not the raw URL, so cardinality stays bounded regardless
  of how many distinct emails/ids are actually requested; unmatched/404 requests are
  labeled `route="unmatched"` for the same reason), and `status_code`. Exposed at
  `GET /metrics`.
- **`python-service`** (FastAPI): [`prometheus-fastapi-instrumentator`](https://github.com/trallnag/prometheus-fastapi-instrumentator),
  the standard minimal integration — `Instrumentator().instrument(app).expose(app)` —
  giving the equivalent shape (a request duration histogram and a request count by
  status) automatically, also at `GET /metrics`.

Both were verified locally (a bare `node -e "require('./server.js')"` /
`uvicorn main:app`, then `curl .../metrics`) before anything was containerized, to
confirm the instrumentation was real and request-driven, not a static stub.

## Getting the instrumented code into the cluster

Committed and pushed like any other change, which — per this project's CI/CD pipeline
([docs/ci-pipeline.md](ci-pipeline.md)) — triggered a real GitHub Actions run that
built and pushed new images to GHCR tagged with the new commit SHA
(`be3de6fde14071a41b8416e2aecbf5804a883773`). `k8s/backend.yaml` and
`k8s/python-service.yaml` were updated to that SHA and rolled out with
`kubectl apply` — the same real-CI-image discipline established in
[docs/k8s-deployment.md](k8s-deployment.md), not a local rebuild pushed straight into
the cluster.

## The monitoring stack (`k8s/monitoring/`)

A new `monitoring` namespace, separate from `roomsync`, scraping across the namespace
boundary via fully-qualified service DNS:

| File | What it is |
|---|---|
| `namespace.yaml` | the `monitoring` namespace |
| `prometheus-configmap.yaml` | `prometheus.yml` — scrapes `backend.roomsync.svc.cluster.local:5000/metrics`, `python-service.roomsync.svc.cluster.local:8000/metrics`, and Prometheus itself |
| `prometheus.yaml` | Prometheus Deployment + ClusterIP Service (port 9090) |
| `grafana-datasource-configmap.yaml` | provisions the Prometheus datasource (fixed `uid: prometheus`) — no manual "Add data source" click |
| `grafana-dashboard-provider-configmap.yaml` | tells Grafana to auto-load any dashboard JSON from `/var/lib/grafana/dashboards` |
| `grafana-dashboard-json-configmap.yaml` | the actual dashboard — 3 panels: **Uptime** (`up{job=...}` as a stat panel), **p95 Latency** (`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))`), **Error rate** (non-2xx request rate ÷ total request rate, per job) |
| `grafana.yaml` | Grafana Deployment + ClusterIP Service (port 3000), anonymous admin access (`GF_AUTH_ANONYMOUS_*`) — a local-demo simplification, not how a real deployment would be configured |

One label-shape nuance worth noting: `backend`'s counter labels the status field
`status_code` with a literal code (`"401"`, `"404"`), while
`prometheus-fastapi-instrumentator`'s labels it `status` with a bucketed value
(`"2xx"`, `"4xx"`) — the two client libraries' own defaults, not something this
project chose. The error-rate panel accounts for this with one query per job rather
than a single query assuming a shared label schema.

```bash
kubectl apply -f k8s/monitoring/
kubectl wait --for=condition=Ready pod -l app=prometheus -n monitoring --timeout=120s
kubectl wait --for=condition=Ready pod -l app=grafana -n monitoring --timeout=120s
```

Both pods confirmed `Running`/`1/1 Ready`.

## Verification with real data — not an empty dashboard

### 1. Prometheus targets are actually `up`

Checked against Prometheus's own `/api/v1/targets` API, not just "the ConfigMap looks
right":

```
backend        -> up   http://backend.roomsync.svc.cluster.local:5000/metrics
prometheus     -> up   http://localhost:9090/metrics
python-service -> up   http://python-service.roomsync.svc.cluster.local:8000/metrics
```

### 2. Real traffic generated against the deployed app

Port-forwarded `backend` and `python-service` directly and hit a real mix of
endpoints — including genuine error responses, not just happy-path 200s:

- `GET /api/health` (backend) → `200`, repeated
- `GET /api/admin/some-protected-route` with no auth header → `401` (the real
  `requireAuth` middleware from [SECURITY.md](../SECURITY.md) correctly rejecting it)
- `GET /api/nonexistent-path` → `404`
- `GET /health` (python-service) → `200`, repeated
- `GET /nonexistent-path` (python-service) → `404`

Confirmed the resulting counters directly via Prometheus's query API before touching
Grafana at all, e.g.:

```
http_requests_total{job="backend", route="/api/admin", status_code="401"} = 11
http_requests_total{job="backend", route="unmatched", status_code="404"} = 6
http_requests_total{job="python-service", handler="none", status="4xx"} = 9
```

and the error-rate expressions themselves resolving to real non-zero fractions:

```
backend error rate:        0.1059  (≈10.6%)
python-service error rate: 0.0673  (≈6.7%)
```

(Traffic was deliberately spread across several `sleep`-separated bursts rather than
one instant batch — `rate()` over a window only reflects *increases observed within
that window*; a single burst that completes before Prometheus's next scrape produces
a `rate` of 0 even though real errors occurred, since nothing changed *during* the
observed interval. Not a bug, just a real property of counters worth designing the
traffic-generation around.)

### 3. The provisioned Grafana dashboard, with genuine populated data

`docs/monitoring-screenshots/01-grafana-dashboard.png`:

- **Uptime** — both `backend` and `python-service` show `UP` in green.
- **p95 Latency** — two distinct, non-zero lines (python-service noticeably higher
  than backend, consistent with FastAPI's default instrumentator overhead vs. the
  lighter Express middleware).
- **Error rate** — both lines visibly rise from 0% to real values matching the direct
  Prometheus query above almost exactly (~10-11% backend, ~6-7% python-service) once
  the traffic-generation bursts land.

An empty or all-zero dashboard would prove nothing beyond "the ConfigMap parsed" —
this one shows the actual shape of real, generated traffic.

## Known simplifications (same spirit as the rest of this DevOps track)

- Grafana runs with anonymous admin access enabled — fine for a local `kind` demo,
  not how a real deployment would be secured.
- No `PersistentVolumeClaim` for either Prometheus or Grafana — metrics/dashboards
  reset on pod restart, consistent with this whole stack being a point-in-time
  demonstration rather than a long-running production monitoring setup.
- Access is via `kubectl port-forward`, the same choice made (and justified) for the
  app itself in [docs/k8s-deployment.md](k8s-deployment.md).
