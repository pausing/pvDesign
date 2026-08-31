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

## Deploy on Hostinger VPS + Dokploy

Production is one Docker image: FastAPI serves the built UI and `/api` on port **8000**. Project JSON lives in a Docker volume so deploys do not wipe designs.

### 1. Push this repo to GitHub

Commit `Dockerfile`, `docker-compose.yml`, and the backend changes, then `git push` to `pausing/pvDesign`.

### 2. VPS

1. Order a Hostinger VPS with the **Ubuntu + Dokploy** template (4 GB RAM is safer for the first image build).
2. Open `http://YOUR_VPS_IP:3000` and create the Dokploy admin account.
3. In Hostinger hPanel → VPS → Firewall, allow **22**, **80**, **443**, and **3000**.
4. Point a domain A record at the VPS IP (one for Dokploy, one for the app if you use two names).
5. In Dokploy **Settings**, set the Dokploy domain, your email, and **Let's Encrypt**.

### 3. Create the app in Dokploy

1. **New Project** → e.g. `pv-design`.
2. **Add Service** → **Compose**.
3. Provider: **GitHub** (or Git) → repository `pausing/pvDesign` → branch `main`.
4. Compose path: `docker-compose.yml`.
5. **Environment** tab, add (use your real public URL, no trailing slash):

```
CORS_ORIGINS=https://your-domain.com
```

6. **Domains** tab: domain `your-domain.com`, service `app`, HTTPS on, certificate Let's Encrypt, **internal port `8000`**.
7. **Advanced**: turn on **Isolated Deployments** if you run more than one compose stack.
8. **Deploy**. First build compiles the frontend inside Docker and can take several minutes.

Open `https://your-domain.com`. You should see the projects page and `/api/health` should return `{"ok":true}`.

Auto-deploy: in the compose service, enable **AutoDeploy** so a push to `main` rebuilds.

### Local production image

```bash
cp .env.example .env
docker compose up --build
```

Then open http://localhost:8000.
