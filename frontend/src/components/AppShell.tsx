import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, downloadJson, pickJsonFile } from "../api/client";
import { useProject } from "../lib/useProject";
import type { AppModule, Project } from "../types/project";
import { Button, StatusDot } from "./ui";

const layoutTools = [
  { to: "tools/config", label: "Catalog & BT/MV" },
  { to: "tools/conceptual", label: "Conceptual" },
  { to: "tools/layout", label: "Plant layout" },
];

export function AppShell({ module }: { module: AppModule }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useProject(id);
  const plantsHref = module === "layout_config" ? "/layout-config" : "/its";
  const groupingActive = location.pathname.endsWith("/grouping");
  const quantitiesActive = location.pathname.endsWith("/quantities");
  const hierarchyActive = location.pathname.endsWith("/hierarchy");
  const assetsActive = location.pathname.endsWith("/assets");
  const canvasActive = module === "layout_config" && !location.pathname.includes("/tools/");
  const toolActive = location.pathname.includes("/tools/");

  const exportProject = () => {
    if (!ctx.project) return;
    downloadJson(`${ctx.project.name.replace(/\s+/g, "_")}.pvdes.json`, ctx.project);
  };

  const importProject = async () => {
    try {
      const data = (await pickJsonFile()) as Project;
      const imported = await api.importProject({ ...data, module });
      navigate(module === "layout_config" ? `/layout-config/${imported.id}` : `/its/${imported.id}/assets`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
        <button
          type="button"
          onClick={() => navigate(plantsHref)}
          className="text-[13px] text-muted hover:text-text"
        >
          ← Plants
        </button>
        <div className="h-4 w-px bg-line" />
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-[0.14em] text-accent">
            {module === "layout_config" ? "Layout configuration" : "ITS Design"}
          </div>
          <div className="truncate text-[13px] font-medium">{ctx.project?.name ?? "…"}</div>
        </div>
        <nav className="ml-4 flex flex-wrap items-center gap-1">
          {module === "layout_config" ? (
            <>
              <NavLink
                to="."
                end
                className={() =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    canvasActive
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                Placement
              </NavLink>
              <select
                className={`ml-1 text-[12px] ${toolActive ? "text-accent" : "text-muted"}`}
                value={layoutTools.find((t) => location.pathname.includes(`/${t.to}`))?.to ?? ""}
                onChange={(e) => {
                  if (e.target.value) navigate(e.target.value);
                }}
              >
                <option value="">Plant tools…</option>
                {layoutTools.map((tool) => (
                  <option key={tool.to} value={tool.to}>
                    {tool.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <NavLink
                to="assets"
                className={() =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    assetsActive
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                Assets
              </NavLink>
              <NavLink
                to="hierarchy"
                className={() =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    hierarchyActive
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                Hierarchy
              </NavLink>
              <NavLink
                to="quantities"
                className={() =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    quantitiesActive
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                Quantities
              </NavLink>
              <NavLink
                to="grouping"
                className={() =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    groupingActive
                      ? "bg-accent-dim text-accent"
                      : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                Grouping
              </NavLink>
            </>
          )}
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
