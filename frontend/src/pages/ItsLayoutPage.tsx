import { useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Button, Field, NumInput, TextInput } from "../components/ui";
import {
  firstSpec,
  itemsOf,
  newItsItem,
  specById,
  stringsForTable,
} from "../lib/itsDesign";
import { ITS_ITEM_LABEL, ITS_KIND_COLOR } from "../lib/itsKinds";
import type { ItsItemKind, ItsPlacedItem } from "../types/project";
import type { ItsOutletContext } from "./ItsWorkspace";

type Tool = "select" | ItsItemKind;
type Selection = { type: "item"; id: string } | null;

export function ItsLayoutPage() {
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
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
  const tables = itemsOf(block, "table");
  const boxes = itemsOf(block, "string_box");
  const skids = itemsOf(block, "its");
  const stringCount = block.strings.length;
  const selectedItem = selection?.type === "item" ? block.items.find((i) => i.id === selection.id) : null;

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

  const usedOnBox = (boxId: string) =>
    Object.values(block.assignments.string_to_box).filter((xid) => xid === boxId).length;

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
            {tables.length} table fields · {boxes.length} boxes · {skids.length} ITS · {stringCount}{" "}
            strings from geometry
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
            Drag to pan. Place tables, string boxes, and the ITS. Table geometry syncs strings on
            this layout plant.
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col overflow-auto p-4">
        <h3 className="text-[13px] font-medium">Placed equipment</h3>
        <p className="mt-1 text-[12px] text-muted">
          Equipment for this layout plant only. ITS Design has its own plants.
        </p>
        <ul className="mt-3 space-y-2 text-[12px]">
          {tables.map((table) => {
            const tracker = specById(block, table.spec_id) ?? firstSpec(block, "tracker");
            return (
              <li key={table.id}>
                <button type="button" className="text-left hover:text-accent" onClick={() => setSelection({ type: "item", id: table.id })}>
                  {table.name} · {table.rows}×{table.tables_per_row} · {stringsForTable(table, tracker)} str
                </button>
              </li>
            );
          })}
          {boxes.map((box) => (
            <li key={box.id}>
              <button type="button" className="text-left hover:text-accent" onClick={() => setSelection({ type: "item", id: box.id })}>
                {box.name} · {usedOnBox(box.id)} strings attached
              </button>
            </li>
          ))}
          {skids.map((skid) => (
            <li key={skid.id}>
              <button type="button" className="text-left hover:text-accent" onClick={() => setSelection({ type: "item", id: skid.id })}>
                {skid.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
