# 🏫 Intelligent Hostel Roommate Allocation System

A cutting-edge, machine learning-driven web platform designed to seamlessly orchestrate student hostel allocations. By parsing complex behavioral profiles, sleep patterns, and academic habits, this system generates mathematically optimized roommate clusters while providing a comprehensive suite of administrative override and management tools.

---

## ▶️ How to run this project

There are exactly two ways to run RoomSync. Pick one — don't mix them.

### Option A — Docker (one command, recommended for a quick look)

Use this if you just want the app running with **its own fresh demo dataset** — its
MongoDB is a separate container with its own data volume, independent of any MongoDB
you have installed locally. It does **not** see your local install's data, and your
local install's MongoDB (if any) does not see it either.

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/), running
(check the whale icon in your system tray — `docker info` should show both a `Client`
*and* a `Server` section with no errors before you proceed).

```bash
cd PBL2
npm install
npm run dev
```
(Windows convenience alternative: `.\start.ps1` — same result, but first checks Docker
Desktop is actually running and that ports 3000/5000/8000/27017 aren't already held by
some other non-Docker process, and tells you clearly instead of failing confusingly.)

First run builds all 3 images and takes a few minutes; every run after that reuses the
build cache and comes up in seconds.

**Success looks like:** open **http://localhost:3000** — you should see the RoomSync
landing page, and be able to log in via the dev-login role picker (no password) and
reach `/student` or `/admin`. `npm run dev:logs` tails all 4 services' logs if you want
to watch it start; `npm run dev:down` stops everything, `npm run dev:clean` also wipes
the container Mongo's data volume.

### Option B — Manual, 4 terminals (use your existing local Mongo + real dataset)

Use this if you want to work against **your actual local MongoDB install** — the one
with the real accumulated demo data (students, submitted profiles, generated room
allocations), not a fresh empty database.

**Requires:** Node.js 18+, Python 3.9+, and a local MongoDB Community Server already
running on `localhost:27017`.

```bash
# Terminal 1 — MongoDB: make sure your local instance is running, nothing to start here
# if it's already installed as a service.

# Terminal 2 — Node backend
cd backend
npm install
node server.js

# Terminal 3 — Python allocation service
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 4 — Frontend
cd frontend
npm install
npm run dev
```

**Success looks like:** the same **http://localhost:3000** landing page, but any data
you see (submitted profiles, generated allocations) is whatever's actually in your local
`hostel_allocator` database — not a fresh one.

---

## ✨ Core Features

### 🎓 **Student Portal**
- **Sleek Preference Onboarding**: Seamless integration with external Google Forms to securely capture over 30 behavioral/compatibility datapoints.
- **Real-Time Status Tracking**: Live dashboard updating students on their allocation pipeline (Not Submitted → Pending Allocation → Allocated).
- **Match Insights**: View assigned room details, roommate contact information, and academic branches.
- **Room Change Requests**: An integrated dispute pipeline allowing students to formally submit and track the status of roommate change requests natively in the dashboard.

### 🛡️ **Administrator Operations Console**
- **One-Click Data Synchronization**: Instantly pull and serialize massive datasets from Google Sheets directly into the active MongoDB cluster.
- **ML Engine Triggering**: Fire the Python clustering algorithm to intelligently map hundreds of students into 3-person rooms based on compatibility heuristics.
- **Dynamic Allocations Manager**:
  - **Manual Swapping**: A forgiving, prefix-friendly engine to forcibly swap specific students between generated rooms.
  - **Room Locking**: Permanently freeze specific room allocations to prevent subsequent algorithmic overwrites.
  - **CSV Export Engine**: Automatically generates rich Excel-ready reports detailing every student, their assigned room, block, and compatibility scores.
- **Change Request Supervisor**: A dedicated panel linking student change requests to their live runtime room placement (Original Room vs Currently Placed In).

---

## 🛠️ Technology Stack

This application is powered by a robust microservice-oriented architecture.

### **Frontend Client**
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS, Vanilla CSS
- **Interactions**: Framer Motion, Lucide React Icons
- **State/Fetching**: Axios, React Hooks

### **Primary Backend (Node.js API)**
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB (via Mongoose)
- **Role**: Primary system of record, authentication, synchronization pipelines, manual override handling, and data aggregation capabilities.

### **Machine Learning Engine (Python Service)**
- **Runtime**: Python & FastAPI
- **Libraries**: Pandas, Scikit-learn
- **Role**: Specialized microservice dedicated exclusively to running heavy clustering, Euclidean space mapping, and unassigned pool calculation algorithms.

---

## 🏗️ Architecture

Four services, wired together via `docker-compose.yml` (see Quick Start below):

1. **`frontend/`** — Next.js 16 (App Router) + NextAuth. Talks to the backend over HTTP
   (browser → `NEXT_PUBLIC_API_URL`; this app's own server-side code, e.g. NextAuth
   callbacks → `BACKEND_URL`).
2. **`backend/`** (Node/Express + Socket.IO) — the system of record. Owns MongoDB,
   authentication, and all REST endpoints the frontend calls.
3. **Python allocation service** (`backend/main.py`, FastAPI) — a genuinely separate
   microservice. The backend calls it over **real HTTP** (`POST /allocate/v2`, via
   `PYTHON_SERVICE_URL`) when `USE_REST_ALLOCATION=true` (the current default) — **not**
   by spawning a subprocess. `POST /allocate/v2` wraps `ml_engine/executor.py`'s actual
   matching logic directly. The old `child_process.spawn(executor.py)` path and the
   legacy `/api/allocate` route still exist in the code as a fallback, but they are not
   the live path.
4. **MongoDB** — the shared database, reached by the backend at `MONGO_URI`.

---

## ⚡ Quick Start (Docker)

Requires Docker Desktop. Run `npm install && npm run dev` from the `PBL2/` root (or `.\start.ps1` on Windows) — this brings up all 4 services (frontend, backend, Python allocation service, and MongoDB). First run builds images and takes longer; subsequent runs are fast.

> **Note:** The Compose stack's MongoDB is a fresh container with its own data volume, separate from any MongoDB you may already be running locally. Existing local demo data will **not** appear inside the Compose stack unless it's deliberately migrated.

Other scripts (from `PBL2/`):
- `npm run dev:down` — stop the stack
- `npm run dev:logs` — tail logs from all services
- `npm run dev:clean` — stop the stack and remove its data volume

See [CLAUDE.md](CLAUDE.md) for full architecture/context notes.

---

## 🚀 Local Development Setup (manual, without Docker)

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- MongoDB Community Server (Running on `localhost:27017`)

### 1. Initialize MongoDB
Ensure your local MongoDB instance is active. The application connects via:  
`mongodb://127.0.0.1:27017/hostel_allocator`

### 2. Boot the Primary Backend (Node.js)
```bash
cd backend
npm install
node server.js
```
*The Node.js server will spin up on `http://localhost:5000`.*

### 3. Boot the ML Engine (Python)
```bash
cd backend
# Optional: Setup virtual environment (python -m venv venv)
pip install fastapi uvicorn pandas scikit-learn requests pydantic
uvicorn main:app --reload --port 8000
```
*The Python microservice will spin up on `http://localhost:8000`.*

### 4. Boot the Frontend Client
```bash
cd frontend
npm install
npm run dev
```
*Access the application via `http://localhost:3000`.*

---

## ⚙️ Configuration

Every environment variable either service actually reads is documented in-line in:
- [`backend/.env.example`](backend/.env.example) — copy to `backend/.env`
- [`frontend/.env.local.example`](frontend/.env.local.example) — copy to `frontend/.env.local`

Both are safe to read (placeholder values only) and are the source of truth for
configuration — not this README.

---

## 🔒 Security & Roles
- **Admin Access**: Navigate to `/admin` to access the protected synchronization tools and allocation workflows.
- **Student Access**: Navigate to `/student` for the end-user dashboard. Unauthorized access to admin panels is aggressively blocked by session tracking.

---

## ⚠️ Known Limitations

Minor, low-priority pre-existing issues, tracked here rather than silently fixed:

- **"Welcome back, Unknown" greeting**: The student dashboard can greet an allocated
  student as "Welcome back, Unknown" instead of their real name. `Profile.name` defaults
  to `"Unknown Name"` (the questionnaire never actually collects a name field) instead of
  falling back to `session.user.name`, which is already available.
- **Stale "Original Assigned Room: Unknown" display**: `/admin/requests` can show
  `Original Assigned Room: Unknown (ID: )` for older change-request records whose
  `currentRoomId` reference no longer resolves via `.populate()`.
- **Duplicate conflict-reason bullets**: The student dashboard's "Things to discuss
  together" list can show the same bullet twice (e.g. a guest-frequency mismatch) for a
  3-person room, because conflict reasons aren't de-duplicated the way `recommendations`
  is (which uses a `Set`).
- **2 orphaned chat messages from student_5@sitpune.edu.in**: reference a `room_id` that
  was deleted during the 2026-09-02 allocation-data regeneration; the messages still
  exist in the `chats` collection but aren't reachable via any current room's chat thread.
