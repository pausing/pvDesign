import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, downloadJson, pickJsonFile } from "../api/client";
import { useProject } from "../lib/useProject";
import type { Project } from "../types/project";
import { Button, StatusDot } from "./ui";

const plantTools = [
  { to: "plant/config", label: "Catalog & BT/MV" },
  { to: "plant/conceptual", label: "Conceptual" },
  { to: "plant/layout", label: "Plant layout" },
];

export function AppShell() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useProject(id);
  const itsActive = /\/its(\/|$)/.test(location.pathname);
  const layoutConfigActive = location.pathname.includes("/layout-config");
  const plantActive = location.pathname.includes("/plant/");
  const homeActive = Boolean(id) && /\/projects\/[^/]+$/.test(location.pathname);

  const exportProject = () => {
    if (!ctx.project) return;
    downloadJson(`${ctx.project.name.replace(/\s+/g, "_")}.pvdes.json`, ctx.project);
  };

  const importProject = async () => {
    try {
      const data = (await pickJsonFile()) as Project;
      const imported = await api.importProject(data);
      navigate(`/projects/${imported.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-[13px] text-muted hover:text-text"
        >
          ← Projects
        </button>
        <div className="h-4 w-px bg-line" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">
            {ctx.project?.name ?? "…"}
          </div>
          {ctx.project?.site || ctx.project?.owner ? (
            <div className="truncate text-[11px] text-muted">
              {[ctx.project?.site, ctx.project?.owner].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
        <nav className="ml-4 flex flex-wrap items-center gap-1">
          <NavLink
            to="."
            end
            className={() =>
              `rounded-md px-3 py-1.5 text-[13px] ${
                homeActive ? "bg-accent-dim text-accent" : "text-muted hover:bg-raised hover:text-text"
              }`
            }
          >
            Modules
          </NavLink>
          <NavLink
            to="layout-config"
            className={() =>
              `rounded-md px-3 py-1.5 text-[13px] ${
                layoutConfigActive
                  ? "bg-accent-dim text-accent"
                  : "text-muted hover:bg-raised hover:text-text"
              }`
            }
          >
            Layout configuration
          </NavLink>
          <NavLink
            to="its"
            className={() =>
              `rounded-md px-3 py-1.5 text-[13px] ${
                itsActive ? "bg-accent-dim text-accent" : "text-muted hover:bg-raised hover:text-text"
              }`
            }
          >
            ITS Design
          </NavLink>
          <select
            className={`ml-1 text-[12px] ${plantActive ? "text-accent" : "text-muted"}`}
            value={plantTools.find((t) => location.pathname.includes(`/${t.to}`))?.to ?? ""}
            onChange={(e) => {
              if (e.target.value) navigate(e.target.value);
            }}
          >
            <option value="">Plant tools…</option>
            {plantTools.map((tool) => (
              <option key={tool.to} value={tool.to}>
                {tool.label}
              </option>
            ))}
          </select>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <StatusDot status={ctx.status} />
          <Button variant="ghost" onClick={() => void importProject()}>
            Import
          </Button>
          <Button onClick={exportProject} disabled={!ctx.project}>
            Export
          </Button>
        </div>
      </header>
      {ctx.error && ctx.status === "error" && !ctx.project ? (
        <div className="p-8 text-danger">{ctx.error}</div>
      ) : (
        <div className="min-h-0 flex-1">
          <Outlet context={ctx} />
        </div>
      )}
    </div>
  );
}
