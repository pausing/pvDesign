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

  const itsBlocks = itsDesignOf(project).blocks.length;
  const itsHref =
    itsBlocks > 0
      ? `/projects/${project.id}/its/${itsDesignOf(project).blocks[0].id}/assets`
      : `/projects/${project.id}/its`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-medium tracking-tight">{project.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Two design modules in this project. Plant Design is the existing plant-wide catalog,
          conceptual BOM, and block/row planner. ITS Design is a single PV-block workflow:
          asset specs, layout, and string → string box → ITS grouping.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">Plant Design</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Asset library, electrical hierarchy, BT/MV Excel import, conceptual BOM, and
            plant layout of tracker blocks and stations.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => navigate(`/projects/${project.id}/config`)}>
              Open Config
            </Button>
            <Button onClick={() => navigate(`/projects/${project.id}/layout`)}>Layout</Button>
          </div>
        </Card>
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">ITS Design</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Design one PV block: module/string/string-box/ITS specs, table-field layout, and
            electrical grouping with overload and orphan checks.
          </p>
          <p className="mt-2 text-[12px] text-muted">
            {itsBlocks === 0 ? "No PV blocks yet." : `${itsBlocks} PV block${itsBlocks === 1 ? "" : "s"}`}
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate(itsHref)}>
              Open ITS Design
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
