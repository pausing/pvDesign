import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button, Card } from "../components/ui";
import {
  assignBoxesToIts,
  assignStringsToBox,
  itemsOf,
  specById,
  validateItsBlock,
} from "../lib/itsDesign";
import type { ItsOutletContext } from "./ItsWorkspace";

export function ItsGroupingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const [pickedStrings, setPickedStrings] = useState<string[]>([]);
  const [pickedBoxes, setPickedBoxes] = useState<string[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedItsId, setSelectedItsId] = useState<string | null>(null);

  const validation = useMemo(() => validateItsBlock(block), [block]);
  const tables = itemsOf(block, "table");
  const boxes = itemsOf(block, "string_box");
  const skids = itemsOf(block, "its");
  const selectedBox = boxes.find((b) => b.id === selectedBoxId) ?? null;
  const selectedIts = skids.find((s) => s.id === selectedItsId) ?? null;

  const toggleString = (sid: string) => {
    setPickedStrings((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };
  const toggleBox = (bid: string) => {
    setPickedBoxes((prev) => (prev.includes(bid) ? prev.filter((x) => x !== bid) : [...prev, bid]));
  };

  const assignPickedStrings = (boxId: string | null) => {
    if (!pickedStrings.length) return;
    updateBlock((current) => assignStringsToBox(current, pickedStrings, boxId));
    setPickedStrings([]);
  };
  const assignPickedBoxes = (itsId: string | null) => {
    if (!pickedBoxes.length) return;
    updateBlock((current) => assignBoxesToIts(current, pickedBoxes, itsId));
    setPickedBoxes([]);
  };
  const assignTableToBox = (tableId: string, boxId: string) => {
    const ids = block.strings.filter((s) => s.table_id === tableId).map((s) => s.id);
    updateBlock((current) => assignStringsToBox(current, ids, boxId));
  };

  const usedOnBox = (boxId: string) =>
    Object.values(block.assignments.string_to_box).filter((id) => id === boxId).length;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_340px]">
      <section className="flex min-h-0 flex-col overflow-hidden border-b border-line lg:border-b-0 lg:border-r">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-medium">Electrical grouping</h2>
          <p className="text-[12px] text-muted">
            Strings from Layout configuration feed string boxes, then the ITS. Select a box or
            ITS, then assign.{" "}
            <button
              type="button"
              className="text-accent"
              onClick={() => id && navigate(`/projects/${id}/layout-config/${block.id}`)}
            >
              Open layout
            </button>
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {validation.string_count} strings · {validation.assigned_strings} assigned ·{" "}
            {validation.orphan_strings} orphan
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2">
          <Button
            variant="primary"
            disabled={!pickedStrings.length || !selectedBox}
            onClick={() => selectedBox && assignPickedStrings(selectedBox.id)}
          >
            Strings → box
          </Button>
          <Button
            variant="primary"
            disabled={!pickedBoxes.length || !selectedIts}
            onClick={() => selectedIts && assignPickedBoxes(selectedIts.id)}
          >
            Boxes → ITS
          </Button>
          <Button variant="ghost" onClick={() => assignPickedStrings(null)} disabled={!pickedStrings.length}>
            Unassign strings
          </Button>
        </div>
        {validation.warnings.length ? (
          <div className="max-h-28 overflow-auto border-b border-line px-4 py-2">
            {validation.warnings.map((w, i) => (
              <p
                key={`${w.code}-${i}`}
                className={`text-[11px] ${
                  w.level === "fail" ? "text-danger" : w.level === "warn" ? "text-warn" : "text-muted"
                }`}
              >
                {w.message}
              </p>
            ))}
          </div>
        ) : (
          <p className="border-b border-line px-4 py-2 text-[11px] text-accent">Grouping looks complete.</p>
        )}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">String boxes</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {boxes.map((box) => {
              const spec = specById(block, box.spec_id);
              const used = usedOnBox(box.id);
              const cap = spec?.inputs ?? null;
              const overload = cap != null && used > cap;
              const selected = selectedBoxId === box.id;
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => {
                    setSelectedBoxId(box.id);
                    if (pickedStrings.length) assignPickedStrings(box.id);
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-[12px] ${
                    selected ? "border-accent bg-accent-dim text-accent" : "border-line bg-raised text-text"
                  }`}
                >
                  <div>{box.name}</div>
                  <div className={overload ? "text-danger" : "text-muted"}>
                    {used}/{cap ?? "∞"} inputs
                  </div>
                </button>
              );
            })}
            {boxes.length === 0 ? (
              <p className="text-[12px] text-muted">No string boxes yet. Place them in Layout configuration.</p>
            ) : null}
          </div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">ITS</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {skids.map((skid) => {
              const spec = specById(block, skid.spec_id);
              const selected = selectedItsId === skid.id;
              return (
                <button
                  key={skid.id}
                  type="button"
                  onClick={() => {
                    setSelectedItsId(skid.id);
                    if (pickedBoxes.length) assignPickedBoxes(skid.id);
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-[12px] ${
                    selected ? "border-accent bg-accent-dim text-accent" : "border-line bg-raised text-text"
                  }`}
                >
                  <div>{skid.name}</div>
                  <div className="text-muted">
                    {spec?.inverter_count ?? "?"} inv · {spec?.transformer_mva ?? "?"} MVA
                  </div>
                </button>
              );
            })}
            {skids.length === 0 ? (
              <p className="text-[12px] text-muted">No ITS yet. Place one in Layout configuration.</p>
            ) : null}
          </div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">Strings</p>
          {tables.map((table) => {
            const strings = block.strings.filter((s) => s.table_id === table.id);
            return (
              <div key={table.id} className="mb-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-text">{table.name}</span>
                  {selectedBox ? (
                    <button
                      type="button"
                      className="text-[11px] text-accent"
                      onClick={() => assignTableToBox(table.id, selectedBox.id)}
                    >
                      All → {selectedBox.name}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {strings.map((string) => {
                    const boxId = block.assignments.string_to_box[string.id];
                    const box = boxes.find((b) => b.id === boxId);
                    const picked = pickedStrings.includes(string.id);
                    return (
                      <button
                        key={string.id}
                        type="button"
                        onClick={() => toggleString(string.id)}
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          picked ? "bg-accent-dim text-accent" : "bg-raised text-muted"
                        }`}
                        title={box ? box.name : "Unassigned"}
                      >
                        {string.name.replace(`${table.name} · `, "")}
                        {box ? ` → ${box.name}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {block.strings.length === 0 ? (
            <p className="text-[12px] text-muted">No strings. Add tables in Layout configuration.</p>
          ) : null}
        </div>
      </section>
      <aside className="min-h-0 overflow-auto p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">Tree</p>
        {skids.length === 0 ? (
          <p className="text-[12px] text-muted">Place an ITS in Layout configuration to see the tree.</p>
        ) : (
          skids.map((skid) => {
            const childBoxes = boxes.filter((b) => block.assignments.box_to_its[b.id] === skid.id);
            return (
              <Card key={skid.id} className="mb-2 p-2">
                <button
                  type="button"
                  className="text-[13px] font-medium text-amber"
                  onClick={() => setSelectedItsId(skid.id)}
                >
                  {skid.name}
                </button>
                {childBoxes.map((box) => {
                  const spec = specById(block, box.spec_id);
                  const kids = block.strings.filter((s) => block.assignments.string_to_box[s.id] === box.id);
                  const picked = pickedBoxes.includes(box.id);
                  return (
                    <div key={box.id} className="mt-1 pl-2">
                      <label className="flex items-center gap-2 text-[12px]">
                        <input type="checkbox" checked={picked} onChange={() => toggleBox(box.id)} />
                        <span>
                          {box.name}{" "}
                          <span className="text-muted">
                            {kids.length}/{spec?.inputs ?? "∞"}
                          </span>
                        </span>
                      </label>
                      <div className="pl-6 text-[11px] text-muted">
                        {kids.length} strings
                        {kids.length > 0 ? ` · ${kids.slice(0, 3).map((s) => s.name).join(", ")}` : ""}
                        {kids.length > 3 ? "…" : ""}
                      </div>
                    </div>
                  );
                })}
                {boxes.filter((b) => !block.assignments.box_to_its[b.id]).length ? (
                  <p className="mt-1 pl-2 text-[11px] text-warn">
                    {boxes.filter((b) => !block.assignments.box_to_its[b.id]).length} unassigned box(es)
                  </p>
                ) : null}
              </Card>
            );
          })
        )}
      </aside>
    </div>
  );
}
