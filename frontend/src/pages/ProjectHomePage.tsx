import { useNavigate, useOutletContext } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { itsDesignOf } from "../lib/itsDesign";
import type { ProjectContext } from "../lib/useProject";

export function ProjectHomePage() {
  const { project } = useOutletContext<ProjectContext>();
  const navigate = useNavigate();

  if (!project) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  const design = itsDesignOf(project);
  const first = design.blocks[0];
  const layoutHref = first
    ? `/projects/${project.id}/layout-config/${first.id}`
    : `/projects/${project.id}/layout-config`;
  const itsHref = first
    ? `/projects/${project.id}/its/${first.id}/assets`
    : `/projects/${project.id}/its`;
  const blockLabel =
    design.blocks.length === 0
      ? "No PV blocks yet."
      : `${design.blocks.length} PV block${design.blocks.length === 1 ? "" : "s"}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-medium tracking-tight">{project.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Two modules share one PV block. Place equipment in Layout configuration, then define
          specs and electrical grouping in ITS Design.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">Layout configuration</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Place table fields, string boxes, and the ITS. Table geometry syncs strings used by
            ITS Design.
          </p>
          <p className="mt-2 text-[12px] text-muted">{blockLabel}</p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate(layoutHref)}>
              Open layout
            </Button>
          </div>
        </Card>
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">ITS Design</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Asset hierarchy and specs, then strings → string box → ITS grouping with orphan and
            overload checks.
          </p>
          <p className="mt-2 text-[12px] text-muted">{blockLabel}</p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate(itsHref)}>
              Open ITS Design
            </Button>
          </div>
        </Card>
      </div>
      <p className="mt-8 text-[12px] text-muted">
        Older plant-wide catalog, conceptual BOM, BT/MV Excel, and plant layout live under{" "}
        <button
          type="button"
          className="text-accent"
          onClick={() => navigate(`/projects/${project.id}/plant/config`)}
        >
          Plant tools
        </button>
        .
      </p>
    </div>
  );
}
