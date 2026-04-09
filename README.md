# 🏫 Intelligent Hostel Roommate Allocation System

A cutting-edge, machine learning-driven web platform designed to seamlessly orchestrate student hostel allocations. By parsing complex behavioral profiles, sleep patterns, and academic habits, this system generates mathematically optimized roommate clusters while providing a comprehensive suite of administrative override and management tools.

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

## 🚀 Local Development Setup

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

## 🔒 Security & Roles
- **Admin Access**: Navigate to `/admin` to access the protected synchronization tools and allocation workflows.
- **Student Access**: Navigate to `/student` for the end-user dashboard. Unauthorized access to admin panels is aggressively blocked by session tracking.
