import { useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Button, Card, Field, NumInput, TextInput } from "../components/ui";
import {
  assignBoxesToIts,
  assignStringsToBox,
  firstSpec,
  itemsOf,
  newItsItem,
  specById,
  stringsForTable,
  validateItsBlock,
} from "../lib/itsDesign";
import { ITS_ITEM_LABEL, ITS_KIND_COLOR } from "../lib/itsKinds";
import type { ItsItemKind, ItsPlacedItem } from "../types/project";
import type { ItsOutletContext } from "./ItsWorkspace";

type Tool = "select" | ItsItemKind;
type Selection =
  | { type: "item"; id: string }
  | { type: "string"; id: string }
  | null;

export function ItsLayoutPage() {
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [pickedStrings, setPickedStrings] = useState<string[]>([]);
  const [pickedBoxes, setPickedBoxes] = useState<string[]>([]);
  const moved = useRef(false);
  const drag = useRef<{
    kind: "pan" | "item";
    id?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const view = block.view ?? { x: 0, y: 0, zoom: 1 };
  const validation = useMemo(() => validateItsBlock(block), [block]);
  const tables = itemsOf(block, "table");
  const boxes = itemsOf(block, "string_box");
  const skids = itemsOf(block, "its");
  const selectedItem = selection?.type === "item" ? block.items.find((i) => i.id === selection.id) : null;
  const selectedBox = selectedItem?.kind === "string_box" ? selectedItem : null;
  const selectedIts = selectedItem?.kind === "its" ? selectedItem : null;

  const clientToWorld = (e: MouseEvent | WheelEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - view.x) / view.zoom,
      y: (e.clientY - rect.top - view.y) / view.zoom,
    };
  };

  const setView = (next: Partial<typeof view>) => {
    updateBlock((current) => ({ ...current, view: { ...current.view, ...next } }));
  };

  const addItem = (kind: ItsItemKind, x: number, y: number) => {
    const specKind = kind === "table" ? "tracker" : kind;
    const spec = firstSpec(block, specKind);
    const count = itemsOf(block, kind).length + 1;
    const item = {
      ...newItsItem(kind, spec?.id ?? null, `${ITS_ITEM_LABEL[kind]} ${count}`),
      x,
      y,
    };
    updateBlock((current) => ({ ...current, items: [...current.items, item] }));
    setSelection({ type: "item", id: item.id });
    setTool("select");
  };

  const patchItem = (id: string, patch: Partial<ItsPlacedItem>) => {
    updateBlock((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (id: string) => {
    updateBlock((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    setSelection(null);
  };

  const onCanvasMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    moved.current = false;
    const world = clientToWorld(e);
    if (tool !== "select") {
      addItem(tool, world.x, world.y);
      return;
    }
    drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
  };

  const onItemMouseDown = (e: MouseEvent, item: ItsPlacedItem) => {
    e.stopPropagation();
    moved.current = false;
    setSelection({ type: "item", id: item.id });
    drag.current = {
      kind: "item",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
    };
  };

  const onMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    if (d.kind === "pan") {
      setView({ x: d.origX + dx, y: d.origY + dy });
    } else if (d.id) {
      patchItem(d.id, { x: d.origX + dx / view.zoom, y: d.origY + dy / view.zoom });
    }
  };

  const onMouseUp = () => {
    drag.current = null;
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = Math.min(2.4, Math.max(0.35, view.zoom * factor));
    setView({ zoom: nextZoom });
  };

  const toggleString = (id: string) => {
    setPickedStrings((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleBox = (id: string) => {
    setPickedBoxes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      <section className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          {(
            [
              ["select", "Select"],
              ["table", "Add tables"],
              ["string_box", "Add string box"],
              ["its", "Add ITS"],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} variant={tool === key ? "primary" : "default"} onClick={() => setTool(key)}>
              {label}
            </Button>
          ))}
          <span className="ml-auto text-[12px] text-muted">
            {validation.string_count} strings · {validation.assigned_strings} assigned ·{" "}
            {validation.orphan_strings} orphan
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            className="h-full w-full touch-none bg-ink"
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
              {tables.map((table) => {
                const tracker = specById(block, table.spec_id) ?? firstSpec(block, "tracker");
                const w = 28 * table.tables_per_row;
                const h = 18 * table.rows;
                const selected = selectedItem?.id === table.id;
                return (
                  <g
                    key={table.id}
                    transform={`translate(${table.x} ${table.y})`}
                    onMouseDown={(e) => onItemMouseDown(e, table)}
                    className="cursor-pointer"
                  >
                    <rect
                      width={w}
                      height={h}
                      rx={4}
                      fill="#163326"
                      stroke={selected ? "#3dcc8c" : ITS_KIND_COLOR.table}
                      strokeWidth={selected ? 2 : 1}
                    />
                    {Array.from({ length: table.rows }).map((_, r) =>
                      Array.from({ length: table.tables_per_row }).map((__, c) => (
                        <rect
                          key={`${r}-${c}`}
                          x={3 + c * 28}
                          y={3 + r * 18}
                          width={22}
                          height={12}
                          rx={1}
                          fill="#2a6b4c"
                        />
                      )),
                    )}
                    <text x={4} y={h + 12} fill="#8b93a7" fontSize={10}>
                      {table.name} · {stringsForTable(table, tracker)} str
                    </text>
                  </g>
                );
              })}
              {boxes.map((box) => {
                const spec = specById(block, box.spec_id);
                const used = usedOnBox(box.id);
                const cap = spec?.inputs ?? null;
                const overload = cap != null && used > cap;
                const selected = selectedItem?.id === box.id;
                return (
                  <g
                    key={box.id}
                    transform={`translate(${box.x} ${box.y})`}
                    onMouseDown={(e) => onItemMouseDown(e, box)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!moved.current && pickedStrings.length) {
                        assignPickedStrings(box.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      width={56}
                      height={36}
                      rx={4}
                      fill={overload ? "#3d1c1c" : "#1b2a3d"}
                      stroke={selected ? "#3dcc8c" : overload ? "#e05a5a" : ITS_KIND_COLOR.string_box}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <text x={6} y={15} fill="#e8eaef" fontSize={10}>
                      {box.name}
                    </text>
                    <text x={6} y={28} fill="#8b93a7" fontSize={9}>
                      {used}/{cap ?? "∞"}
                    </text>
                  </g>
                );
              })}
              {skids.map((skid) => {
                const spec = specById(block, skid.spec_id);
                const selected = selectedItem?.id === skid.id;
                return (
                  <g
                    key={skid.id}
                    transform={`translate(${skid.x} ${skid.y})`}
                    onMouseDown={(e) => onItemMouseDown(e, skid)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!moved.current && pickedBoxes.length) {
                        assignPickedBoxes(skid.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      width={88}
                      height={52}
                      rx={5}
                      fill="#3d3216"
                      stroke={selected ? "#3dcc8c" : ITS_KIND_COLOR.its}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <text x={8} y={18} fill="#e8eaef" fontSize={11}>
                      {skid.name}
                    </text>
                    <text x={8} y={34} fill="#8b93a7" fontSize={9}>
                      {spec?.inverter_count ?? "?"} inv · {spec?.transformer_mva ?? "?"} MVA
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        {selectedItem ? (
          <div className="grid grid-cols-2 gap-3 border-t border-line px-3 py-2 sm:grid-cols-5">
            <Field label="Name">
              <TextInput value={selectedItem.name} onChange={(v) => patchItem(selectedItem.id, { name: v })} />
            </Field>
            <Field label="Spec">
              <select
                className="w-full text-[13px]"
                value={selectedItem.spec_id ?? ""}
                onChange={(e) => patchItem(selectedItem.id, { spec_id: e.target.value || null })}
              >
                <option value="">None</option>
                {block.catalog
                  .filter((s) =>
                    selectedItem.kind === "table" ? s.kind === "tracker" : s.kind === selectedItem.kind,
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            {selectedItem.kind === "table" ? (
              <>
                <Field label="Rows">
                  <NumInput
                    value={selectedItem.rows}
                    min={1}
                    onChange={(v) => patchItem(selectedItem.id, { rows: Math.max(1, v ?? 1) })}
                  />
                </Field>
                <Field label="Tables / row">
                  <NumInput
                    value={selectedItem.tables_per_row}
                    min={1}
                    onChange={(v) =>
                      patchItem(selectedItem.id, { tables_per_row: Math.max(1, v ?? 1) })
                    }
                  />
                </Field>
              </>
            ) : (
              <div />
            )}
            <div className="flex items-end">
              <Button variant="danger" onClick={() => removeItem(selectedItem.id)}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-line px-3 py-2 text-[12px] text-muted">
            Drag to pan. Place tables, string boxes, and the ITS. Select a string box, then assign
            strings from the list — or click a box after multi-selecting strings.
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-line px-3 py-2">
          <h3 className="text-[13px] font-medium">Electrical grouping</h3>
          <p className="text-[11px] text-muted">
            Strings → string box → ITS. Select a box or ITS on the canvas, then assign.
          </p>
        </div>
        <div className="flex gap-2 border-b border-line px-3 py-2">
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
            Unassign
          </Button>
        </div>
        {validation.warnings.length ? (
          <div className="max-h-28 overflow-auto border-b border-line px-3 py-2">
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
          <p className="border-b border-line px-3 py-2 text-[11px] text-accent">Grouping looks complete.</p>
        )}
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Strings</p>
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
          {block.strings.some((s) => !s.table_id) ? (
            <div className="mb-3">
              <p className="mb-1 text-[12px]">Loose strings</p>
              {block.strings
                .filter((s) => !s.table_id)
                .map((string) => (
                  <label key={string.id} className="flex items-center gap-2 text-[12px] text-muted">
                    <input
                      type="checkbox"
                      checked={pickedStrings.includes(string.id)}
                      onChange={() => toggleString(string.id)}
                    />
                    {string.name}
                  </label>
                ))}
            </div>
          ) : null}

          <p className="mb-1 mt-2 text-[11px] uppercase tracking-wide text-muted">Tree</p>
          {skids.length === 0 ? (
            <p className="text-[12px] text-muted">Place an ITS to see the tree.</p>
          ) : (
            skids.map((skid) => {
              const childBoxes = boxes.filter((b) => block.assignments.box_to_its[b.id] === skid.id);
              return (
                <Card key={skid.id} className="mb-2 p-2">
                  <div className="text-[13px] font-medium text-amber">{skid.name}</div>
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
        </div>
      </aside>
    </div>
  );
}
