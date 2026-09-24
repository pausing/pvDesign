# PV Design

Utility-scale PV plant design tool. Choose a module first; each module has its own plants.

- **Layout configuration** — independent plants for placing table fields, string boxes, and the ITS. Optional catalog / BT-MV / conceptual / plant layout live inside these plants.
- **ITS Design** — independent plants for asset specs and strings → string box → ITS grouping.

Plants are tagged `module: layout_config | its_design` and do not share a home.

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

Open http://localhost:5173/pv/. A seeded **Demo 100 MW** project is created on first API start.

Open http://localhost:5173/pv/ → pick a module → that module’s plant list (`/pv/layout-config` or `/pv/its`).

Projects are stored as JSON files under `backend/data/projects/`.

## Deploy on Hostinger VPS + Dokploy (Nixpacks)

Use a Dokploy **Application** with build type **Nixpacks**. The UI is built during deploy; FastAPI serves it and `/api` on port **8000**.

`nixpacks.toml` at the repo root is the build plan. Project JSON is stored in `/data` — mount a volume there or designs are lost on each deploy.

### Deployment as Standalone App (root path)

This is the original deployment method at the root of a domain (e.g., `https://powerlearn.us/`).

#### 1. Push to GitHub

Commit and push `nixpacks.toml`, `requirements.txt`, and `.python-version` to `main`.

#### 2. VPS

1. Hostinger VPS with the **Ubuntu + Dokploy** template (4 GB RAM is safer for the Node build).
2. Open `http://YOUR_VPS_IP:3000` and create the admin account.
3. Firewall: **22**, **80**, **443**, **3000**.
4. Point a domain A record at the VPS IP.
5. Dokploy **Settings**: domain, email, **Let's Encrypt**.

#### 3. Create the web app

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
PV_BASE_PATH=/
```

7. **Advanced → Mounts:** add a volume with mount path `/data`.
8. **Domains:** your domain, HTTPS, Let's Encrypt, container port **8000**.
9. Enable **AutoDeploy**, then **Deploy**.

Open `https://your-domain.com`. `/api/health` should return `{"ok":true}`.

---

### Deployment Behind Portal with ForwardAuth (path prefix `/pv`)

This deployment method makes PV Design accessible **only** at `https://portal.powerlearn.us/pv/` after portal authentication. It uses Traefik ForwardAuth for access control.

**Important:** Do NOT merge the portal or SLLR repositories into this repo. They remain separate applications.

#### 1. Portal Application (if not already deployed)

Deploy your portal application first at `portal.powerlearn.us` with ForwardAuth configured.

The portal must expose an auth verification endpoint (e.g., `http://portal-service:8000/auth/verify`).

#### 2. PV Design Application Configuration

1. **New Project** → e.g. `pv-design-portal`.
2. **Add Service** → **Application**.
3. Provider: **GitHub** → `pausing/pvDesign` → branch `main`.
4. **Build type:** Nixpacks.
5. **Port:** `8000`.
6. **Environment:**

```
CORS_ORIGINS=https://portal.powerlearn.us
STATIC_DIR=frontend/dist
PVDES_DATA_DIR=/data
PV_BASE_PATH=/pv
```

7. **Advanced → Mounts:** add a volume with mount path `/data`.

#### 3. Domain and Path Configuration

1. **Domains:** 
   - Domain: `portal.powerlearn.us`
   - Path: `/pv`
   - Container Port: `8000`
   - HTTPS via Let's Encrypt

#### 4. ForwardAuth Middleware

Configure Traefik ForwardAuth to protect the `/pv` path:

- **ForwardAuth Address:** `http://<portal-service-name>:8000/auth/verify`
- **Trust Forward Header:** Enable
- Apply this middleware to the PV Design application

This ensures that:
- All requests to `https://portal.powerlearn.us/pv/*` are checked for authentication
- Unauthenticated users are redirected to portal login
- Authenticated users can access PV Design within the portal

#### 5. Verify Deployment

After deployment:
- `https://portal.powerlearn.us/pv/` → PV Design app (requires portal login)
- `https://portal.powerlearn.us/pv/api/health` → `{"ok":true}` (requires portal login)
- The original `https://powerlearn.us/` remains separate and should be decommissioned if desired

---

### Optional: Docker Compose

`Dockerfile` and `docker-compose.yml` are still in the repo if you prefer a Compose service instead of Nixpacks.
