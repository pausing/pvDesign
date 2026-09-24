import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ItsHierarchyTree } from "../components/ItsHierarchyTree";
import { Button } from "../components/ui";
import type { ItsOutletContext } from "./ItsWorkspace";

export function ItsHierarchyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();

  return (
    <div className="mx-auto h-full min-h-0 max-w-3xl overflow-auto px-6 py-6">
      <h2 className="text-[15px] font-medium">Hierarchy</h2>
      <p className="mt-1 text-[13px] text-muted">
        Conceptual order of asset types for this PV block. Rearrange type blocks here. Exact counts
        are set on Quantities; grouping still uses strings → string boxes → ITS.
      </p>
      <div className="mt-4">
        <ItsHierarchyTree block={block} onMove={(next) => updateBlock(() => next)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => id && navigate(`/its/${id}/quantities`)}>
          Set quantities
        </Button>
        <Button onClick={() => id && navigate(`/its/${id}/grouping`)}>Go to grouping</Button>
      </div>
    </div>
  );
}
