# PV Design

Utility-scale PV plant design tool: asset library, hierarchical electrical topology, conceptual BOM, and a block/row layout planner.

## Run locally

**Backend** (FastAPI, port 8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Vite, port 5173):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. A seeded **Demo 100 MW** project is created on first API start.

Projects are stored as JSON files under `backend/data/projects/`.
