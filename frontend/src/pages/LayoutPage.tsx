import { useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Button, Card, Field, NumInput, TextInput } from "../components/ui";
import { BlockDetailView } from "../components/BlockDetailView";
import { NorthIndicator } from "../components/NorthIndicator";
import { uid } from "../lib/ids";
import {
  addInverterStation,
  addMvBus,
  addTrackerBlock,
  removeInverterStation,
  removeTrackerBlock,
  setStationInverterCount,
} from "../lib/plantLayout";
import { analyzePlant, asForest, firstOfKind, layoutCounts, trackersPerInverter, treeForSource } from "../lib/topology";
import { projectParameters } from "../lib/parameters";
import { stationRole } from "../lib/reconcile";
import type { ProjectContext } from "../lib/useProject";
import type {
  CableKind,
  CableRun,
  InverterStation,
  LayoutNodeType,
  Orientation,
  TrackerBlock,
} from "../types/project";

type Ctx = ProjectContext;
type Tool = "select" | "block" | "station" | "mvbus" | "dc_l0" | "dc_l1" | "cbl_mv";
type Selection =
  | { type: "block"; id: string }
  | { type: "station"; id: string }
  | { type: "cable"; id: string }
  | null;

const CABLE_STROKE: Record<CableKind, string> = {
  dc_l0: "#f472b6",
  dc_l1: "#fb7185",
  mv: "#fb923c",
};

export function LayoutPage() {
  const { project, update } = useOutletContext<Ctx>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingFrom, setPendingFrom] = useState<{
    id: string;
    type: LayoutNodeType;
  } | null>(null);
  const [detailBlockId, setDetailBlockId] = useState<string | null>(null);
  const moved = useRef(false);
  const drag = useRef<{
    kind: "pan" | "item";
    id?: string;
    itemType?: "block" | "station";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const cableKind = (t: Tool): CableKind | null => {
    if (t === "dc_l0") return "dc_l0";
    if (t === "dc_l1") return "dc_l1";
    if (t === "cbl_mv") return "mv";
    return null;
  };

  const layout = project?.layout;
  const pan = layout?.view ?? { x: 0, y: 0, zoom: 1 };

  const topology = useMemo(
    () => (project ? analyzePlant(project) : null),
    [project],
  );
  const placed = useMemo(
    () => (project ? layoutCounts(project) : { trackers: 0, inverters: 0 }),
    [project],
  );

  if (!project || !layout) return <div className="p-8 text-muted">Loading…</div>;

  const params = projectParameters(project);

  const detailBlock = detailBlockId
    ? layout.blocks.find((b) => b.id === detailBlockId)
    : undefined;
  if (detailBlock) {
    return (
      <BlockDetailView
        block={detailBlock}
        project={project}
        onBack={() => setDetailBlockId(null)}
        onPatchBlock={(patch) =>
          update((p) => ({
            ...p,
            layout: {
              ...p.layout,
              blocks: p.layout.blocks.map((b) =>
                b.id === detailBlock.id ? { ...b, ...patch } : b,
              ),
            },
          }))
        }
      />
    );
  }

  const patchLayout = (partial: Partial<typeof layout>) => {
    update((p) => ({ ...p, layout: { ...p.layout, ...partial } }));
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / pan.zoom,
      y: (clientY - rect.top - pan.y) / pan.zoom,
    };
  };

  const addBlock = (x: number, y: number) => {
    update((p) => addTrackerBlock(p, x, y));
    setTool("select");
  };

  const addStation = (x: number, y: number, mv: boolean) => {
    if (mv) {
      update((p) => addMvBus(p, x, y));
    } else {
      update((p) => addInverterStation(p, x, y));
    }
    setTool("select");
  };

  const onCanvasClick = (e: MouseEvent<SVGSVGElement>) => {
    if (moved.current) return;
    const { x, y } = clientToWorld(e.clientX, e.clientY);
    if (tool === "block") addBlock(x, y);
    else if (tool === "station") addStation(x, y, false);
    else if (tool === "mvbus") addStation(x, y, true);
    else if (tool === "select") setSelection(null);
  };

  const beginPan = (e: MouseEvent) => {
    if (tool === "block" || tool === "station" || tool === "mvbus") return;
    if (e.button !== 0 && e.button !== 1) return;
    moved.current = false;
    drag.current = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const beginItemDrag = (
    e: MouseEvent,
    itemType: "block" | "station",
    id: string,
    origX: number,
    origY: number,
  ) => {
    e.stopPropagation();
    const kind = cableKind(tool);
    if (kind) {
      const nodeType: LayoutNodeType = itemType === "block" ? "block" : "station";
      if (!pendingFrom) {
        setPendingFrom({ id, type: nodeType });
        return;
      }
      if (pendingFrom.id === id) {
        setPendingFrom(null);
        return;
      }
      const run: CableRun = {
        id: uid("run"),
        kind,
        from_id: pendingFrom.id,
        to_id: id,
        from_type: pendingFrom.type,
        to_type: nodeType,
      };
      patchLayout({ cable_runs: [...layout.cable_runs, run] });
      setPendingFrom(null);
      setTool("select");
      setSelection({ type: "cable", id: run.id });
      return;
    }
    setSelection({ type: itemType, id });
    moved.current = false;
    drag.current = {
      kind: "item",
      itemType,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
    };
  };

  const onMouseMove = (e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) {
      moved.current = true;
    }
    if (d.kind === "pan") {
      patchLayout({
        view: {
          ...pan,
          x: d.origX + (e.clientX - d.startX),
          y: d.origY + (e.clientY - d.startY),
        },
      });
      return;
    }
    const dx = (e.clientX - d.startX) / pan.zoom;
    const dy = (e.clientY - d.startY) / pan.zoom;
    if (d.itemType === "block") {
      patchLayout({
        blocks: layout.blocks.map((b) =>
          b.id === d.id ? { ...b, x: d.origX + dx, y: d.origY + dy } : b,
        ),
      });
    } else if (d.itemType === "station") {
      patchLayout({
        stations: layout.stations.map((s) =>
          s.id === d.id ? { ...s, x: d.origX + dx, y: d.origY + dy } : s,
        ),
      });
    }
  };

  const onMouseUp = () => {
    drag.current = null;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = Math.min(2.5, Math.max(0.35, pan.zoom * factor));
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - pan.x) / pan.zoom;
    const wy = (cy - pan.y) / pan.zoom;
    patchLayout({
      view: {
        zoom: nextZoom,
        x: cx - wx * nextZoom,
        y: cy - wy * nextZoom,
      },
    });
  };

  const selectedBlock = selection?.type === "block"
    ? layout.blocks.find((b) => b.id === selection.id)
    : null;
  const selectedStation = selection?.type === "station"
    ? layout.stations.find((s) => s.id === selection.id)
    : null;
  const selectedCable = selection?.type === "cable"
    ? layout.cable_runs.find((c) => c.id === selection.id)
    : null;

  const removeSelected = () => {
    if (!selection) return;
    if (selection.type === "block") {
      update((p) => removeTrackerBlock(p, selection.id));
    } else if (selection.type === "station") {
      update((p) => removeInverterStation(p, selection.id));
    } else {
      patchLayout({
        cable_runs: layout.cable_runs.filter((c) => c.id !== selection.id),
      });
    }
    setSelection(null);
  };

  const trackerDelta = placed.trackers - (topology?.trackers ?? 0);
  const inverterDelta = placed.inverters - (topology?.inverters ?? 0);
  const sourceRoot = selectedBlock
    ? asForest(project.topology).find((r) => r.id === selectedBlock.source_id)
    : null;
  const sourceAsset = sourceRoot
    ? project.catalog.find((a) => a.id === sourceRoot.asset_id)
    : null;

  const anchors = new Map<string, { x: number; y: number }>();
  for (const b of layout.blocks) {
    const spec = firstOfKind(treeForSource(project, b.source_id), project.catalog, "tracker");
    const { w, h } = blockSize(
      b,
      spec?.asset.table_length_m ?? 64,
      spec?.asset.table_width_m ?? 2.4,
    );
    anchors.set(b.id, { x: b.x + w / 2, y: b.y + h / 2 });
  }
  for (const s of layout.stations) {
    anchors.set(s.id, { x: s.x + 40, y: s.y + 24 });
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
          {(
            [
              ["select", "Select"],
              ["block", "Tracker block"],
              ["station", "Inverter station"],
              ["mvbus", "MV bus"],
              ["dc_l1", "DC L1 run"],
              ["cbl_mv", "MV run"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant={tool === id ? "primary" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                setTool(id);
                setPendingFrom(null);
              }}
            >
              {label}
            </Button>
          ))}
          <span className="ml-2 text-[12px] text-muted">
            Scroll to zoom · add block/PCS to grow the plant · remove to update Config
            {pendingFrom ? " · click a second asset to finish the cable" : ""}
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          className="h-full w-full bg-ink"
          onClick={onCanvasClick}
          onMouseDown={beginPan}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1b212c" strokeWidth="1" />
            </pattern>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
            <rect x={-4000} y={-4000} width={8000} height={8000} fill="url(#grid)" />
            {layout.cable_runs.map((run) => {
              const a = anchors.get(run.from_id);
              const b = anchors.get(run.to_id);
              if (!a || !b) return null;
              const selected = selection?.type === "cable" && selection.id === run.id;
              const midX = (a.x + b.x) / 2;
              return (
                <path
                  key={run.id}
                  d={`M ${a.x} ${a.y} Q ${midX} ${a.y} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={CABLE_STROKE[run.kind]}
                  strokeWidth={selected ? 3 : 1.6}
                  strokeDasharray={run.kind === "mv" ? "6 4" : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ type: "cable", id: run.id });
                  }}
                />
              );
            })}
            {layout.blocks.map((block) => {
              const spec = firstOfKind(
                treeForSource(project, block.source_id),
                project.catalog,
                "tracker",
              );
              return (
              <BlockShape
                key={block.id}
                block={block}
                selected={selection?.type === "block" && selection.id === block.id}
                pending={pendingFrom?.id === block.id}
                tableLength_m={spec?.asset.table_length_m ?? 64}
                tableWidth_m={spec?.asset.table_width_m ?? 2.4}
                onMouseDown={(e) => beginItemDrag(e, "block", block.id, block.x, block.y)}
                onDoubleClick={() => {
                  setSelection({ type: "block", id: block.id });
                  setDetailBlockId(block.id);
                }}
              />
              );
            })}
            {layout.stations.map((station) => (
              <StationShape
                key={station.id}
                station={station}
                selected={selection?.type === "station" && selection.id === station.id}
                pending={pendingFrom?.id === station.id}
                onMouseDown={(e) => beginItemDrag(e, "station", station.id, station.x, station.y)}
              />
            ))}
          </g>
        </svg>
        <NorthIndicator />
        </div>
      </div>

      <aside className="w-72 shrink-0 overflow-auto border-l border-line bg-panel p-4">
        <h2 className="text-[15px] font-medium">Plant from config</h2>
        <div className="mt-3 space-y-2">
          <DeltaRow
            label="Trackers"
            placed={placed.trackers}
            target={topology?.trackers ?? 0}
            delta={trackerDelta}
          />
          <DeltaRow
            label="Inverters"
            placed={placed.inverters}
            target={topology?.inverters ?? 0}
            delta={inverterDelta}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Blocks and PCS stations are the same plant as Config / Conceptual. Add or remove them
          here to change inverter count, BOM, and DC/AC. Cable routes are only drawing.
        </p>

        <div className="mt-6 border-t border-line pt-4">
          {!selection ? (
            <p className="text-[13px] text-muted">Select a block, station, or cable.</p>
          ) : null}

          {selectedBlock ? (
            <div className="space-y-3">
              <div className="text-[13px] font-medium">Tracker block</div>
              <Field label="Name">
                <TextInput
                  value={selectedBlock.name}
                  onChange={(v) =>
                    patchLayout({
                      blocks: layout.blocks.map((b) =>
                        b.id === selectedBlock.id ? { ...b, name: v } : b,
                      ),
                    })
                  }
                />
              </Field>
              <p className="rounded-md border border-line bg-raised px-3 py-2 text-[12px] text-muted">
                Grid {selectedBlock.rows}×{selectedBlock.trackers_per_row} ·{" "}
                {selectedBlock.rows * selectedBlock.trackers_per_row} trackers
                {sourceAsset ? ` · ${sourceAsset.name}` : ""}
                {trackersPerInverter(project, selectedBlock.source_id)
                  ? ` · ${trackersPerInverter(project, selectedBlock.source_id)} per inverter`
                  : ""}
                . Add or remove a block to change that inverter type’s count.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Orientation">
                  <select
                    value={selectedBlock.orientation}
                    onChange={(e) =>
                      patchLayout({
                        blocks: layout.blocks.map((b) =>
                          b.id === selectedBlock.id
                            ? { ...b, orientation: e.target.value as Orientation }
                            : b,
                        ),
                      })
                    }
                  >
                    <option value="NS">N–S (axis toward north)</option>
                    <option value="EW">E–W (axis toward east)</option>
                  </select>
                </Field>
              </div>
              <p className="rounded-md border border-line bg-raised px-3 py-2 text-[12px] text-muted">
                Pitch {params.tracker_pitch_m.toFixed(1)} m · N–S gap{" "}
                {params.tracker_ns_gap_m.toFixed(1)} m — set in Config.
              </p>
              <p className="text-[12px] text-muted">
                Removing the block removes that equipment from Config and Conceptual.
              </p>
              <Button
                variant="primary"
                onClick={() => setDetailBlockId(selectedBlock.id)}
              >
                Open detailed layout
              </Button>
              <Button variant="danger" onClick={removeSelected}>
                Remove from plant
              </Button>
            </div>
          ) : null}

          {selectedStation ? (
            <div className="space-y-3">
              <div className="text-[13px] font-medium">
                {stationRole(selectedStation) === "mv" ? "MV bus" : "Inverter station"}
              </div>
              <Field label="Name">
                <TextInput
                  value={selectedStation.name}
                  onChange={(v) =>
                    patchLayout({
                      stations: layout.stations.map((s) =>
                        s.id === selectedStation.id ? { ...s, name: v } : s,
                      ),
                    })
                  }
                />
              </Field>
              {stationRole(selectedStation) !== "mv" ? (
                <Field label="Inverters">
                  <NumInput
                    value={selectedStation.inverter_count}
                    onChange={(v) =>
                      update((p) =>
                        setStationInverterCount(p, selectedStation.id, Math.max(0, v ?? 0)),
                      )
                    }
                  />
                </Field>
              ) : null}
              <p className="text-[12px] text-muted">
                {stationRole(selectedStation) === "mv"
                  ? "MV bus is a collection node for routing. Removing it does not change the BOM."
                  : "Changing this count updates the inverter quantity in Config and Conceptual."}
              </p>
              <Button variant="danger" onClick={removeSelected}>
                {stationRole(selectedStation) === "mv" ? "Remove MV bus" : "Remove from plant"}
              </Button>
            </div>
          ) : null}

          {selectedCable ? (
            <div className="space-y-3">
              <div className="text-[13px] font-medium">Cable run</div>
              <Field label="Kind">
                <select
                  value={selectedCable.kind}
                  onChange={(e) =>
                    patchLayout({
                      cable_runs: layout.cable_runs.map((c) =>
                        c.id === selectedCable.id
                          ? { ...c, kind: e.target.value as CableKind }
                          : c,
                      ),
                    })
                  }
                >
                  <option value="dc_l0">DC L0</option>
                  <option value="dc_l1">DC L1</option>
                  <option value="mv">MV</option>
                </select>
              </Field>
              <Button variant="danger" onClick={removeSelected}>
                Remove route
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DeltaRow({
  label,
  placed,
  target,
  delta,
}: {
  label: string;
  placed: number;
  target: number;
  delta: number;
}) {
  const tone = delta === 0 ? "text-accent" : "text-warn";
  return (
    <Card className="px-3 py-2">
      <div className="flex justify-between text-[12px] text-muted">
        <span>{label}</span>
        <span className={tone}>
          {delta === 0 ? "match" : `${delta > 0 ? "+" : ""}${delta}`}
        </span>
      </div>
      <div className="mt-1 font-mono text-[13px]">
        {placed.toLocaleString()} placed / {target.toLocaleString()} in topology
      </div>
    </Card>
  );
}

function trackerCell(
  block: TrackerBlock,
  tableLength_m = 64,
  tableWidth_m = 2.4,
): { w: number; h: number } {
  const aspect = Math.max(1.2, Math.min(24, tableLength_m / Math.max(0.4, tableWidth_m)));
  const short = 7;
  const long = Math.min(32, short * (aspect / 3));
  return block.orientation === "NS" ? { w: short, h: long } : { w: long, h: short };
}

function blockSize(
  block: TrackerBlock,
  tableLength_m = 64,
  tableWidth_m = 2.4,
): { w: number; h: number } {
  const cell = trackerCell(block, tableLength_m, tableWidth_m);
  const gap = 3;
  const w = block.trackers_per_row * (cell.w + gap) + 16;
  const h = block.rows * (cell.h + gap) + 28;
  return { w, h };
}

function BlockShape({
  block,
  selected,
  pending,
  tableLength_m = 64,
  tableWidth_m = 2.4,
  onMouseDown,
  onDoubleClick,
}: {
  block: TrackerBlock;
  selected: boolean;
  pending: boolean;
  tableLength_m?: number;
  tableWidth_m?: number;
  onMouseDown: (e: MouseEvent) => void;
  onDoubleClick?: () => void;
}) {
  const { w, h } = blockSize(block, tableLength_m, tableWidth_m);
  const cell = trackerCell(block, tableLength_m, tableWidth_m);
  const gap = 3;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < block.rows; r++) {
    for (let c = 0; c < block.trackers_per_row; c++) {
      cells.push({ x: 8 + c * (cell.w + gap), y: 20 + r * (cell.h + gap) });
    }
  }
  return (
    <g
      transform={`translate(${block.x} ${block.y})`}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      onClick={(e) => e.stopPropagation()}
      className="cursor-grab"
    >
      <rect
        width={w}
        height={h}
        rx={6}
        fill="#141820"
        stroke={pending ? "#3dcc8c" : selected ? "#e8a838" : "#2a3140"}
        strokeWidth={selected || pending ? 2 : 1}
      />
      <text x={8} y={14} fill="#8b93a7" fontSize={10}>
        {block.name} · {block.rows}×{block.trackers_per_row} · {block.rows * block.trackers_per_row} trk · {block.orientation}
      </text>
      <text
        x={w - 10}
        y={14}
        textAnchor="middle"
        fill="#e8a838"
        fontSize={9}
        fontWeight={700}
        pointerEvents="none"
      >
        N
      </text>
      {cells.map((pt, i) => (
        <rect
          key={i}
          x={pt.x}
          y={pt.y}
          width={cell.w}
          height={cell.h}
          rx={1}
          fill="#1b3d2f"
          stroke="#3dcc8c"
          strokeWidth={0.4}
        />
      ))}
    </g>
  );
}

function StationShape({
  station,
  selected,
  pending,
  onMouseDown,
}: {
  station: InverterStation;
  selected: boolean;
  pending: boolean;
  onMouseDown: (e: MouseEvent) => void;
}) {
  const mv = stationRole(station) === "mv";
  return (
    <g
      transform={`translate(${station.x} ${station.y})`}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="cursor-grab"
    >
      <rect
        width={80}
        height={48}
        rx={mv ? 24 : 6}
        fill={mv ? "#2a1c10" : "#1b212c"}
        stroke={pending ? "#3dcc8c" : selected ? "#e8a838" : mv ? "#fb923c" : "#fbbf24"}
        strokeWidth={selected || pending ? 2 : 1.4}
      />
      <text x={40} y={20} textAnchor="middle" fill="#e8eaef" fontSize={10}>
        {station.name}
      </text>
      <text x={40} y={36} textAnchor="middle" fill="#8b93a7" fontSize={9}>
        {mv ? "MV" : `${station.inverter_count} INV`}
      </text>
    </g>
  );
}
