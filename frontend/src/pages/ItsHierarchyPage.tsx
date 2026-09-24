import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ItsHierarchyTree } from "../components/ItsHierarchyTree";
import { Button, Card, Field, NumInput } from "../components/ui";
import { applyHierarchy, firstSpec, inferHierarchy, itemsOf } from "../lib/itsDesign";
import type { ItsHierarchy } from "../types/project";
import type { ItsOutletContext } from "./ItsWorkspace";

export function ItsHierarchyPage() {
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
  const [autoAssignOverride, setAutoAssignOverride] = useState<boolean | null>(null);

  const draft: ItsHierarchy = {
    ...qty,
    auto_assign: autoAssignOverride ?? inferred.auto_assign,
    tree_customized: inferred.tree_customized,
  };

  const module = firstSpec(block, "module");
  const stringCount = Math.max(0, draft.table_count) * Math.max(1, draft.strings_per_table);
  const moduleCount = stringCount * Math.max(1, draft.modules_per_string);
  const dcKwp = module?.pmp_w ? (moduleCount * module.pmp_w) / 1000 : null;
  const liveTables = itemsOf(block, "table").reduce((n, t) => n + t.rows * t.tables_per_row, 0);
  const liveBoxes = itemsOf(block, "string_box").length;
  const liveIts = itemsOf(block, "its").length;
  const liveStrings = block.strings.length;
  const customized = Boolean(block.hierarchy?.tree_customized);

  const patchQty = (partial: Partial<typeof qty>) => setQty((prev) => ({ ...prev, ...partial }));

  const apply = () => {
    const next: ItsHierarchy = {
      modules_per_string: Math.max(1, draft.modules_per_string),
      strings_per_table: Math.max(1, draft.strings_per_table),
      table_count: Math.max(0, draft.table_count),
      string_box_count: Math.max(0, draft.string_box_count),
      its_count: Math.max(0, draft.its_count),
      auto_assign: draft.auto_assign,
      tree_customized: draft.tree_customized,
    };
    if (customized && next.auto_assign) {
      const ok = window.confirm(
        "This plant’s tree was rearranged. Auto-assign will rebuild instances and re-round-robin strings → boxes → ITS, discarding those moves. Continue?",
      );
      if (!ok) return;
    } else if (customized && !next.auto_assign) {
      const ok = window.confirm(
        "Apply will resize instances from the counts. Existing parentage is kept for IDs that still exist. Continue?",
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
    setAutoAssignOverride(null);
  };

  const missingSpecs = ["module", "string", "string_box", "its", "tracker"].filter(
    (kind) => !block.catalog.some((s) => s.kind === kind),
  );

  return (
    <div className="mx-auto grid h-full min-h-0 max-w-6xl grid-cols-1 gap-6 overflow-auto px-6 py-6 lg:grid-cols-[1fr_300px]">
      <section className="min-w-0">
        <h2 className="text-[15px] font-medium">Hierarchy</h2>
        <p className="mt-1 text-[13px] text-muted">
          Move asset blocks on the tree to change parentage and order. Counts still create instances
          when you apply. Grouping uses the same assignments.
        </p>
        {missingSpecs.length ? (
          <p className="mt-3 text-[12px] text-warn">
            Missing specs: {missingSpecs.join(", ")}. Add them on Assets first.
          </p>
        ) : null}
        {customized ? (
          <p className="mt-3 text-[12px] text-accent">
            Tree was rearranged. Auto-assign is off so Apply keeps surviving parentage. Turn it back
            on only if you want a fresh round-robin.
          </p>
        ) : null}
        <div className="mt-4">
          <ItsHierarchyTree
            block={block}
            onMove={(next) => {
              setAutoAssignOverride(null);
              updateBlock(() => next);
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={apply} disabled={missingSpecs.length > 0 && !block.catalog.length}>
            Apply hierarchy
          </Button>
          <Button onClick={() => id && navigate(`/its/${id}/grouping`)}>Go to grouping</Button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Live instances: {liveTables} tables · {liveStrings} strings · {liveBoxes} boxes · {liveIts}{" "}
          ITS
        </p>
      </section>
      <aside className="space-y-4">
        <Card className="p-4">
          <div className="text-[12px] uppercase tracking-wide text-muted">Quantities</div>
          <div className="mt-3 grid grid-cols-1 gap-3">
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
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={draft.auto_assign}
                onChange={(e) => setAutoAssignOverride(e.target.checked)}
              />
              Auto-assign strings → boxes → ITS
            </label>
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {draft.its_count} ITS ← {draft.string_box_count} string boxes ← {stringCount} strings ←{" "}
            {draft.table_count} tables ← {moduleCount} modules
            {dcKwp != null ? ` · ${dcKwp.toFixed(1)} kWp` : ""}
          </p>
        </Card>
      </aside>
    </div>
  );
}
