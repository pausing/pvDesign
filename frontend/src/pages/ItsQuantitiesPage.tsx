import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { TypeHierarchyPreview } from "../components/ItsHierarchyTree";
import { Button, Card, Field, NumInput } from "../components/ui";
import { applyHierarchy, firstSpec, inferHierarchy, isDefaultTypeOrder, itemsOf, levelsOf } from "../lib/itsDesign";
import type { ItsHierarchy } from "../types/project";
import type { ItsOutletContext } from "./ItsWorkspace";

export function ItsQuantitiesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const inferred = useMemo(() => inferHierarchy(block), [block]);
  const [qty, setQty] = useState(() => ({
    modules_per_string: inferred.modules_per_string,
    strings_per_table: inferred.strings_per_table,
    table_count: inferred.table_count,
    string_box_count: inferred.string_box_count,
    its_count: inferred.its_count,
  }));
  const [autoAssign, setAutoAssign] = useState(inferred.auto_assign);

  const draft: ItsHierarchy = {
    ...qty,
    auto_assign: autoAssign,
    levels: inferred.levels,
  };

  const module = firstSpec(block, "module");
  const stringCount = Math.max(0, draft.table_count) * Math.max(1, draft.strings_per_table);
  const moduleCount = stringCount * Math.max(1, draft.modules_per_string);
  const dcKwp = module?.pmp_w ? (moduleCount * module.pmp_w) / 1000 : null;
  const liveTables = itemsOf(block, "table").reduce((n, t) => n + t.rows * t.tables_per_row, 0);
  const liveBoxes = itemsOf(block, "string_box").length;
  const liveIts = itemsOf(block, "its").length;
  const liveStrings = block.strings.length;
  const customTypes = !isDefaultTypeOrder(levelsOf(block));

  const patchQty = (partial: Partial<typeof qty>) => setQty((prev) => ({ ...prev, ...partial }));

  const apply = () => {
    const next: ItsHierarchy = {
      modules_per_string: Math.max(1, draft.modules_per_string),
      strings_per_table: Math.max(1, draft.strings_per_table),
      table_count: Math.max(0, draft.table_count),
      string_box_count: Math.max(0, draft.string_box_count),
      its_count: Math.max(0, draft.its_count),
      auto_assign: draft.auto_assign,
      levels: draft.levels,
    };
    if (!next.auto_assign) {
      const ok = window.confirm(
        "Apply will resize instances from these counts. Existing string → box → ITS assignments are kept for IDs that still exist. Continue?",
      );
      if (!ok) return;
    }
    updateBlock((current) => applyHierarchy(current, next));
    setQty({
      modules_per_string: next.modules_per_string,
      strings_per_table: next.strings_per_table,
      table_count: next.table_count,
      string_box_count: next.string_box_count,
      its_count: next.its_count,
    });
  };

  const missingSpecs = ["module", "string", "string_box", "its", "tracker"].filter(
    (kind) => !block.catalog.some((s) => s.kind === kind),
  );

  return (
    <div className="mx-auto grid h-full min-h-0 max-w-5xl grid-cols-1 gap-6 overflow-auto px-6 py-6 lg:grid-cols-[1fr_260px]">
      <section>
        <h2 className="text-[15px] font-medium">Quantities</h2>
        <p className="mt-1 text-[13px] text-muted">
          How many of each asset type this PV block has. Apply creates tables, strings, string boxes,
          and ITS instances for grouping. Type order is set on Hierarchy and is not changed here.
        </p>
        {missingSpecs.length ? (
          <p className="mt-3 text-[12px] text-warn">
            Missing specs: {missingSpecs.join(", ")}. Add them on Assets first.
          </p>
        ) : null}
        {customTypes ? (
          <p className="mt-3 text-[12px] text-accent">
            Conceptual type order was customized. Apply still builds the same instance kinds; grouping
            remains strings → boxes → ITS.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Modules per string">
            <NumInput
              min={1}
              value={draft.modules_per_string}
              onChange={(v) => patchQty({ modules_per_string: v ?? 1 })}
            />
          </Field>
          <Field label="Strings per table">
            <NumInput
              min={1}
              value={draft.strings_per_table}
              onChange={(v) => patchQty({ strings_per_table: v ?? 1 })}
            />
          </Field>
          <Field label="Number of tables">
            <NumInput min={0} value={draft.table_count} onChange={(v) => patchQty({ table_count: v ?? 0 })} />
          </Field>
          <Field label="Number of string boxes">
            <NumInput
              min={0}
              value={draft.string_box_count}
              onChange={(v) => patchQty({ string_box_count: v ?? 0 })}
            />
          </Field>
          <Field label="Number of ITS">
            <NumInput min={0} value={draft.its_count} onChange={(v) => patchQty({ its_count: v ?? 0 })} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-[13px] text-muted">
            <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} />
            Auto-assign strings → boxes → ITS
          </label>
        </div>
        <Card className="mt-4 p-4 text-[13px]">
          <div className="text-[12px] uppercase tracking-wide text-muted">From these counts</div>
          <p className="mt-2 text-muted">
            {draft.its_count} ITS · {draft.string_box_count} string boxes · {stringCount} strings ·{" "}
            {draft.table_count} tables · {moduleCount} modules
            {dcKwp != null ? ` · ${dcKwp.toFixed(1)} kWp` : ""}
          </p>
        </Card>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={apply} disabled={missingSpecs.length > 0 && !block.catalog.length}>
            Apply quantities
          </Button>
          <Button onClick={() => id && navigate(`/its/${id}/hierarchy`)}>Back to hierarchy</Button>
          <Button onClick={() => id && navigate(`/its/${id}/grouping`)}>Go to grouping</Button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Live instances: {liveTables} tables · {liveStrings} strings · {liveBoxes} boxes · {liveIts}{" "}
          ITS
        </p>
      </section>
      <aside>
        <div className="text-[12px] uppercase tracking-wide text-muted">Type order</div>
        <p className="mb-2 mt-1 text-[12px] text-muted">From Hierarchy — not editable here.</p>
        <TypeHierarchyPreview block={block} />
      </aside>
    </div>
  );
}
