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

## Deploy on Hostinger VPS + Dokploy (Nixpacks)

Use a Dokploy **Application** with build type **Nixpacks**. The UI is built during deploy; FastAPI serves it and `/api` on port **8000**.

`nixpacks.toml` at the repo root is the build plan. Project JSON is stored in `/data` — mount a volume there or designs are lost on each deploy.

### 1. Push to GitHub

Commit and push `nixpacks.toml`, `requirements.txt`, and `.python-version` to `main`.

### 2. VPS

1. Hostinger VPS with the **Ubuntu + Dokploy** template (4 GB RAM is safer for the Node build).
2. Open `http://YOUR_VPS_IP:3000` and create the admin account.
3. Firewall: **22**, **80**, **443**, **3000**.
4. Point a domain A record at the VPS IP.
5. Dokploy **Settings**: domain, email, **Let's Encrypt**.

### 3. Create the web app

1. **New Project** → e.g. `pv-design`.
2. **Add Service** → **Application** (not Compose).
3. Provider: **GitHub** → `pausing/pvDesign` → branch `main`.
4. **Build type:** Nixpacks.
5. **Port:** `8000`.
6. **Environment:**

```
CORS_ORIGINS=https://your-domain.com
STATIC_DIR=frontend/dist
PVDES_DATA_DIR=/data
```

7. **Advanced → Mounts:** add a volume with mount path `/data`.
8. **Domains:** your domain, HTTPS, Let's Encrypt, container port **8000**.
9. Enable **AutoDeploy**, then **Deploy**.

Open `https://your-domain.com`. `/api/health` should return `{"ok":true}`.

### Optional: Docker Compose

`Dockerfile` and `docker-compose.yml` are still in the repo if you prefer a Compose service instead of Nixpacks.
