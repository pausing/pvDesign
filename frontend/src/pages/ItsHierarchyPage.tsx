import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button, Card, Field, NumInput } from "../components/ui";
import { applyHierarchy, firstSpec, inferHierarchy, itemsOf } from "../lib/itsDesign";
import type { ItsHierarchy } from "../types/project";
import type { ItsOutletContext } from "./ItsWorkspace";

export function ItsHierarchyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const inferred = useMemo(() => inferHierarchy(block), [block]);
  const [draft, setDraft] = useState<ItsHierarchy>(inferred);

  const module = firstSpec(block, "module");
  const stringCount = Math.max(0, draft.table_count) * Math.max(1, draft.strings_per_table);
  const moduleCount = stringCount * Math.max(1, draft.modules_per_string);
  const dcKwp = module?.pmp_w ? (moduleCount * module.pmp_w) / 1000 : null;
  const liveTables = itemsOf(block, "table").reduce((n, t) => n + t.rows * t.tables_per_row, 0);
  const liveBoxes = itemsOf(block, "string_box").length;
  const liveIts = itemsOf(block, "its").length;
  const liveStrings = block.strings.length;

  const patch = (partial: Partial<ItsHierarchy>) => setDraft((prev) => ({ ...prev, ...partial }));

  const apply = () => {
    const next: ItsHierarchy = {
      modules_per_string: Math.max(1, draft.modules_per_string),
      strings_per_table: Math.max(1, draft.strings_per_table),
      table_count: Math.max(0, draft.table_count),
      string_box_count: Math.max(0, draft.string_box_count),
      its_count: Math.max(0, draft.its_count),
      auto_assign: draft.auto_assign,
    };
    updateBlock((current) => applyHierarchy(current, next));
    setDraft(next);
  };

  const missingSpecs = ["module", "string", "string_box", "its", "tracker"].filter(
    (kind) => !block.catalog.some((s) => s.kind === kind),
  );

  return (
    <div className="mx-auto grid h-full min-h-0 max-w-5xl grid-cols-1 gap-6 overflow-auto px-6 py-6 lg:grid-cols-[1fr_280px]">
      <section>
        <h2 className="text-[15px] font-medium">Hierarchy and quantities</h2>
        <p className="mt-1 text-[13px] text-muted">
          After specs are defined, set how many of each asset this PV block has. Apply creates
          tables, strings, string boxes, and ITS instances for grouping — no layout placement
          required.
        </p>
        {missingSpecs.length ? (
          <p className="mt-3 text-[12px] text-warn">
            Missing specs: {missingSpecs.join(", ")}. Add them on Assets first.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Modules per string">
            <NumInput
              min={1}
              value={draft.modules_per_string}
              onChange={(v) => patch({ modules_per_string: v ?? 1 })}
            />
          </Field>
          <Field label="Strings per table">
            <NumInput
              min={1}
              value={draft.strings_per_table}
              onChange={(v) => patch({ strings_per_table: v ?? 1 })}
            />
          </Field>
          <Field label="Number of tables">
            <NumInput min={0} value={draft.table_count} onChange={(v) => patch({ table_count: v ?? 0 })} />
          </Field>
          <Field label="Number of string boxes">
            <NumInput
              min={0}
              value={draft.string_box_count}
              onChange={(v) => patch({ string_box_count: v ?? 0 })}
            />
          </Field>
          <Field label="Number of ITS">
            <NumInput min={0} value={draft.its_count} onChange={(v) => patch({ its_count: v ?? 0 })} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={draft.auto_assign}
              onChange={(e) => patch({ auto_assign: e.target.checked })}
            />
            Auto-assign strings → boxes → ITS
          </label>
        </div>
        <Card className="mt-4 p-4 text-[13px]">
          <div className="text-[12px] uppercase tracking-wide text-muted">Default tree</div>
          <p className="mt-2 text-muted">
            {draft.its_count} ITS ← {draft.string_box_count} string boxes ← {stringCount} strings ←{" "}
            {draft.table_count} tables ← {moduleCount} modules
            {dcKwp != null ? ` · ${dcKwp.toFixed(1)} kWp` : ""}
          </p>
        </Card>
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
      <aside>
        <Card className="divide-y divide-line">
          {[
            { label: "ITS", detail: `${draft.its_count} skid(s)`, color: "#fbbf24" },
            { label: "String boxes", detail: `${draft.string_box_count} box(es)`, color: "#60a5fa" },
            { label: "Strings", detail: `${stringCount} (${draft.strings_per_table} / table)`, color: "#a3e635" },
            { label: "Tables", detail: `${draft.table_count} table(s)`, color: "#34d399" },
            {
              label: "Modules",
              detail: `${moduleCount} (${draft.modules_per_string} in series)`,
              color: "#6ee7b7",
            },
          ].map((row) => (
            <div key={row.label} className="px-3 py-2">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                {row.label}
              </div>
              <div className="pl-4 text-[11px] text-muted">{row.detail}</div>
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}
