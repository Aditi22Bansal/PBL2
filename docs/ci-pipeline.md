# CI/CD Pipeline

GitHub Actions workflow at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
Triggers on every push to `ahmad-dev` and on pull requests targeting `main`.

```mermaid
flowchart TD
    A["Push to ahmad-dev<br/>or PR targeting main"] --> B["Lint backend (Node)<br/>npm ci + syntax-check + jest test suite"]
    A --> C["Build frontend (Next.js)<br/>npm ci + npm run build"]
    A --> D["Python compile check<br/>py_compile + pytest allocation engine suite"]
    A --> E["Docker build<br/>backend / python-service / frontend"]

    B --> F{"push to ahmad-dev?"}
    C --> F
    D --> F
    E --> F

    F -- "yes" --> G["Push images to GHCR<br/>ghcr.io/aditi22bansal/pbl2-{backend,frontend,python-service}<br/>tagged :&lt;commit-sha&gt; and :latest"]
    F -- "no (PR only)" --> H["Stop — build validated, nothing pushed"]
```

## Job shapes

| Job | What it proves | Needs a live DB? |
|---|---|---|
| `lint-backend` | Node dependency tree resolves; every backend `.js` file parses (`node --check`) — there's no real lint script in `backend/package.json` today; then the real jest suite (`backend/tests/test_*.js`) runs — permanent regression tests for the proven vulnerabilities in [SECURITY.md](../SECURITY.md): admin-route auth, role escalation, tenant isolation, injection hardening, plus rate-limiting/Helmet/audit-log coverage | No (in-memory MongoDB via `mongodb-memory-server`) |
| `lint-frontend` | The exact production build command already used in `frontend/Dockerfile` (`npm run build`) still succeeds | No |
| `python-check` | Every Python source file compiles (`python -m py_compile`); then the real pytest suite (`backend/tests/test_allocation_engine.py`) runs — the allocation engine's proven-important invariants (hard constraints, 100% placement, `needsManualPlacement` correctness, room-size preference, tier priority) | No |
| `docker-build` | All 3 Dockerfiles (`backend/Dockerfile`, `backend/Dockerfile.python`, `frontend/Dockerfile`) still build, via a 3-way matrix | No |
| `push-images` | Only runs on push to `ahmad-dev` (never on a PR); re-builds and pushes the 3 images to GHCR using the built-in `GITHUB_TOKEN` (`packages: write`) — no extra secrets needed | No |

## Where images end up

- `ghcr.io/aditi22bansal/pbl2-backend`
- `ghcr.io/aditi22bansal/pbl2-frontend`
- `ghcr.io/aditi22bansal/pbl2-python-service`

Each tagged with the triggering commit's SHA and `latest`.
