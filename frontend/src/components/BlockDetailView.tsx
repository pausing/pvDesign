import { useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { Button, Card } from "./ui";
import { NorthIndicator } from "./NorthIndicator";
import { KIND_COLOR } from "../lib/kinds";
import {
  buildBlockDetail,
  clearInstanceInnerForIds,
  innerPosesOf,
  polyline,
  snapMetres,
  snapToTrackerGrid,
  snapTrackerPoses,
  upsertInstanceInner,
  upsertTypeInner,
  type DetailRect,
  type DetailRun,
  type DetailSubBlock,
  type TrackerGrid,
} from "../lib/blockLayout";
import type { InnerAssetPose, Project, SubBlockPose, TrackerBlock } from "../types/project";

const L0 = "#f472b6";
const L1 = "#fb7185";
const PX_PER_M = 5;

export function BlockDetailView({
  block,
  project,
  onBack,
  onPatchBlock,
}: {
  block: TrackerBlock;
  project: Project;
  onBack: () => void;
  onPatchBlock: (patch: Partial<TrackerBlock>) => void;
}) {
  const [draftPoses, setDraftPoses] = useState<SubBlockPose[] | null>(null);
  const draftRef = useRef<SubBlockPose[] | null>(null);
  const [draftInner, setDraftInner] = useState<{
    instance: Record<string, InnerAssetPose[]>;
    type: Record<string, InnerAssetPose[]>;
  } | null>(null);
  const draftInnerRef = useRef<typeof draftInner>(null);
  const [applyToType, setApplyToType] = useState(false);
  const applyToTypeRef = useRef(false);
  applyToTypeRef.current = applyToType;
  const [snapGrid, setSnapGrid] = useState(true);
  const snapGridRef = useRef(true);
  snapGridRef.current = snapGrid;
  const model = useMemo(
    () =>
      buildBlockDetail(block, project, {
        poses: draftPoses ?? undefined,
        innerInstance: draftInner?.instance,
        innerType: draftInner?.type,
      }),
    [
      block,
      project.catalog,
      project.topology,
      project.parameters,
      block.rows,
      block.trackers_per_row,
      block.pitch_m,
      block.orientation,
      block.subblock_poses,
      block.subblock_inner,
      block.subblock_type_inner,
      draftPoses,
      draftInner,
    ],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 32, y: 16, zoom: 0.38 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const moved = useRef(false);
  const drag = useRef<
    | {
        kind: "pan";
        startX: number;
        startY: number;
        origX: number;
        origY: number;
      }
    | {
        kind: "sub";
        id: string;
        startMx: number;
        startMy: number;
        origX: number;
        origY: number;
        snapshot: SubBlockPose[];
      }
    | {
        kind: "asset";
        subId: string;
        typeId: string;
        localKey: string;
        isTracker: boolean;
        startMx: number;
        startMy: number;
        origX: number;
        origY: number;
        snapshot: InnerAssetPose[];
      }
    | null
  >(null);

  const selected = model.runs.find((r) => r.id === selectedId) ?? null;
  const selectedSub = model.subBlocks.find((s) => s.id === selectedSubId) ?? null;
  const typeSiblings = selectedSub
    ? model.subBlocks.filter((s) => s.typeId === selectedSub.typeId)
    : [];
  const pxPerM = PX_PER_M;
  const trackerGrid = model.trackerGrid ?? {
    originX: 8,
    originY: 5.4,
    colPitch: model.pitch_m > 0 ? model.pitch_m : 12,
    rowPitch: model.rowGap_m > 0 ? model.rowGap_m : 1,
  };
  const trackerGridRef = useRef(trackerGrid);
  trackerGridRef.current = trackerGrid;

  const clientToMetres = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / pan.zoom / pxPerM,
      y: (clientY - rect.top - pan.y) / pan.zoom / pxPerM,
    };
  };

  const commitPoses = (poses: SubBlockPose[]) => {
    draftRef.current = null;
    setDraftPoses(null);
    onPatchBlock({ subblock_poses: poses });
  };

  const commitInner = (
    subId: string,
    typeId: string,
    poses: InnerAssetPose[],
    toType: boolean,
  ) => {
    draftInnerRef.current = null;
    setDraftInner(null);
    if (toType) {
      const ids = model.subBlocks.filter((s) => s.typeId === typeId).map((s) => s.id);
      onPatchBlock({
        subblock_inner: clearInstanceInnerForIds(block.subblock_inner, ids),
        subblock_type_inner: upsertTypeInner(block.subblock_type_inner, typeId, poses),
      });
      return;
    }
    onPatchBlock({
      subblock_inner: upsertInstanceInner(block.subblock_inner, subId, poses),
    });
  };

  const alignTrackersToGrid = () => {
    const targets = selectedSub ? [selectedSub] : model.subBlocks;
    if (targets.length === 0) return;
    if (selectedSub && applyToTypeRef.current) {
      commitInner(
        selectedSub.id,
        selectedSub.typeId,
        snapTrackerPoses(innerPosesOf(model, selectedSub), trackerGrid),
        true,
      );
      return;
    }
    if (targets.length === 1) {
      const sub = targets[0];
      commitInner(
        sub.id,
        sub.typeId,
        snapTrackerPoses(innerPosesOf(model, sub), trackerGrid),
        false,
      );
      return;
    }
    let inner = block.subblock_inner;
    for (const sub of targets) {
      inner = upsertInstanceInner(
        inner,
        sub.id,
        snapTrackerPoses(innerPosesOf(model, sub), trackerGrid),
      );
    }
    onPatchBlock({ subblock_inner: inner });
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = Math.min(6, Math.max(0.25, pan.zoom * factor));
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - pan.x) / pan.zoom;
    const wy = (cy - pan.y) / pan.zoom;
    setPan({ zoom: nextZoom, x: cx - wx * nextZoom, y: cy - wy * nextZoom });
  };

  const onMouseDown = (e: MouseEvent) => {
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

  const beginSubDrag = (e: MouseEvent, sub: DetailSubBlock) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    moved.current = false;
    const m = clientToMetres(e.clientX, e.clientY);
    const snapshot = model.subBlocks.map((s) => ({
      id: s.id,
      x: s.originX,
      y: s.originY,
    }));
    drag.current = {
      kind: "sub",
      id: sub.id,
      startMx: m.x,
      startMy: m.y,
      origX: sub.originX,
      origY: sub.originY,
      snapshot,
    };
    setSelectedSubId(sub.id);
    setSelectedAssetId(null);
    setSelectedId(null);
  };

  const beginAssetDrag = (e: MouseEvent, rect: DetailRect) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const sub = model.subBlocks.find(
      (s) =>
        s.trackerIds.includes(rect.id) ||
        s.stringBoxIds.includes(rect.id) ||
        s.switchingBoxId === rect.id,
    );
    if (!sub) return;
    moved.current = false;
    const m = clientToMetres(e.clientX, e.clientY);
    const snapshot = innerPosesOf(model, sub);
    const local = snapshot.find((p) => p.key === rect.localKey);
    drag.current = {
      kind: "asset",
      subId: sub.id,
      typeId: sub.typeId,
      localKey: rect.localKey,
      isTracker: sub.trackerIds.includes(rect.id),
      startMx: m.x,
      startMy: m.y,
      origX: local?.x ?? rect.x - sub.originX,
      origY: local?.y ?? rect.y - sub.originY,
      snapshot,
    };
    setSelectedSubId(sub.id);
    setSelectedAssetId(rect.id);
    setSelectedId(null);
  };

  const onMouseMove = (e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) {
        moved.current = true;
      }
      setPan({
        ...pan,
        x: d.origX + (e.clientX - d.startX),
        y: d.origY + (e.clientY - d.startY),
      });
      return;
    }
    const m = clientToMetres(e.clientX, e.clientY);
    if (Math.hypot(m.x - d.startMx, m.y - d.startMy) > 0.2) moved.current = true;
    let x = d.origX + (m.x - d.startMx);
    let y = d.origY + (m.y - d.startMy);
    if (d.kind === "asset" && d.isTracker && snapGridRef.current) {
      const snapped = snapToTrackerGrid(x, y, trackerGridRef.current);
      x = snapped.x;
      y = snapped.y;
    } else {
      x = snapMetres(x);
      y = snapMetres(y);
    }
    if (d.kind === "asset") {
      const poses = d.snapshot.some((p) => p.key === d.localKey)
        ? d.snapshot.map((p) => (p.key === d.localKey ? { ...p, x, y } : p))
        : [...d.snapshot, { key: d.localKey, x, y }];
      const next = applyToTypeRef.current
        ? { instance: {}, type: { [d.typeId]: poses } }
        : { instance: { [d.subId]: poses }, type: {} };
      draftInnerRef.current = next;
      setDraftInner(next);
      return;
    }
    const next = d.snapshot.map((p) => (p.id === d.id ? { ...p, x, y } : p));
    draftRef.current = next;
    setDraftPoses(next);
  };

  const onMouseUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "sub" && draftRef.current) {
      commitPoses(draftRef.current);
    }
    if (d?.kind === "asset" && moved.current && draftInnerRef.current) {
      const poses = applyToTypeRef.current
        ? draftInnerRef.current.type[d.typeId]
        : draftInnerRef.current.instance[d.subId];
      if (poses) commitInner(d.subId, d.typeId, poses, applyToTypeRef.current);
      else {
        draftInnerRef.current = null;
        setDraftInner(null);
      }
    } else if (d?.kind === "asset") {
      draftInnerRef.current = null;
      setDraftInner(null);
    }
  };

  const t = model.totals;
  const scale = pan.zoom * pxPerM;
  const frameColor = (kind: DetailSubBlock["kind"]) =>
    kind === "switching"
      ? KIND_COLOR.switching_box
      : kind === "string"
        ? KIND_COLOR.string_box
        : KIND_COLOR.tracker;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Button variant="ghost" onClick={onBack}>
            ← Plant layout
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{model.blockName} · detailed layout</div>
            <div className="text-[11px] text-muted">
              {model.subBlocks.length} sub-block{model.subBlocks.length === 1 ? "" : "s"} · drag a
              title to move a sub-block · drag trackers / boxes inside
            </div>
          </div>
          <Button
            variant={snapGrid ? "primary" : "default"}
            onClick={() => setSnapGrid((v) => !v)}
          >
            Grid {snapGrid ? "on" : "off"} · {trackerGrid.colPitch.toFixed(1)}×
            {trackerGrid.rowPitch.toFixed(1)} m
          </Button>
          <Button variant="default" onClick={alignTrackersToGrid}>
            Align trackers
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            className="h-full w-full bg-ink"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={() => {
              if (!moved.current) {
                setSelectedId(null);
                setSelectedSubId(null);
                setSelectedAssetId(null);
              }
            }}
          >
            <defs>
              <pattern
                id="mgrid"
                width={pxPerM}
                height={pxPerM}
                patternUnits="userSpaceOnUse"
              >
                <path d={`M ${pxPerM} 0 L 0 0 0 ${pxPerM}`} fill="none" stroke="#1b212c" strokeWidth="0.6" />
              </pattern>
              <pattern
                id="mgrid10"
                width={pxPerM * 10}
                height={pxPerM * 10}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${pxPerM * 10} 0 L 0 0 0 ${pxPerM * 10}`}
                  fill="none"
                  stroke="#2a3140"
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
              <rect
                x={-200}
                y={-200}
                width={model.bounds.w * pxPerM + 800}
                height={model.bounds.h * pxPerM + 800}
                fill="url(#mgrid)"
              />
              <rect
                x={-200}
                y={-200}
                width={model.bounds.w * pxPerM + 800}
                height={model.bounds.h * pxPerM + 800}
                fill="url(#mgrid10)"
              />
              <g transform={`scale(${pxPerM})`}>
                {model.subBlocks.map((sub) => {
                  const color = frameColor(sub.kind);
                  const active = selectedSubId === sub.id;
                  return (
                    <g
                      key={sub.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!moved.current) {
                          setSelectedSubId(sub.id);
                          setSelectedAssetId(null);
                        }
                      }}
                    >
                      <rect
                        x={sub.x}
                        y={sub.y}
                        width={sub.w}
                        height={sub.h}
                        rx={0.6}
                        fill={active ? `${color}18` : "#141820"}
                        stroke={active ? "#e8a838" : color}
                        strokeWidth={active ? 0.35 : 0.18}
                        strokeDasharray={active ? undefined : "1.2 0.7"}
                      />
                      <rect
                        x={sub.originX}
                        y={sub.originY}
                        width={Math.max(sub.w - (sub.originX - sub.x), 12)}
                        height={2.8}
                        rx={0.6}
                        fill="#1b212c"
                        className="cursor-grab"
                        onMouseDown={(e) => beginSubDrag(e, sub)}
                      />
                      <text
                        x={sub.originX + 1.2}
                        y={sub.originY + 1.9}
                        fill={color}
                        fontSize={1.5}
                        fontWeight={600}
                        className="cursor-grab"
                        onMouseDown={(e) => beginSubDrag(e, sub)}
                      >
                        {sub.label}
                      </text>
                      <text
                        x={sub.originX + Math.max(sub.w - (sub.originX - sub.x), 12) - 1.2}
                        y={sub.originY + 1.9}
                        textAnchor="end"
                        fill="#8b93a7"
                        fontSize={1.2}
                        className="cursor-grab"
                        onMouseDown={(e) => beginSubDrag(e, sub)}
                      >
                        {sub.trackerIds.length} trk
                      </text>
                    </g>
                  );
                })}
                {snapGrid
                  ? model.subBlocks.map((sub) => (
                      <TrackerSnapGrid
                        key={`grid-${sub.id}`}
                        sub={sub}
                        grid={trackerGrid}
                      />
                    ))
                  : null}
                {model.runs.map((run) => (
                  <CablePath
                    key={run.id}
                    run={run}
                    selected={selectedId === run.id}
                    onSelect={() => {
                      setSelectedId(run.id);
                      setSelectedSubId(null);
                    }}
                  />
                ))}
                {model.trackers.map((trk) => (
                  <g
                    key={trk.id}
                    className="cursor-grab"
                    onMouseDown={(e) => beginAssetDrag(e, trk)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!moved.current) setSelectedAssetId(trk.id);
                    }}
                  >
                    <rect
                      x={trk.x}
                      y={trk.y}
                      width={trk.w}
                      height={trk.h}
                      rx={0.15}
                      fill="#1b3d2f"
                      stroke={selectedAssetId === trk.id ? "#e8a838" : "#3dcc8c"}
                      strokeWidth={selectedAssetId === trk.id ? 0.28 : 0.12}
                    />
                    {trk.h > 8 ? (
                      <text
                        x={trk.x + trk.w / 2}
                        y={trk.y + 2.2}
                        textAnchor="middle"
                        fill="#8b93a7"
                        fontSize={1.6}
                      >
                        {trk.label}
                      </text>
                    ) : null}
                  </g>
                ))}
                {model.stringBoxes.map((box) => (
                  <g
                    key={box.id}
                    className="cursor-grab"
                    onMouseDown={(e) => beginAssetDrag(e, box)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!moved.current) setSelectedAssetId(box.id);
                    }}
                  >
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.w}
                      height={box.h}
                      rx={0.15}
                      fill="#1e293b"
                      stroke={selectedAssetId === box.id ? "#e8a838" : "#60a5fa"}
                      strokeWidth={selectedAssetId === box.id ? 0.28 : 0.15}
                    />
                    <text
                      x={box.x + box.w / 2}
                      y={box.y + box.h / 2 + 0.45}
                      textAnchor="middle"
                      fill="#93c5fd"
                      fontSize={0.9}
                    >
                      {box.label}
                    </text>
                  </g>
                ))}
                {model.switchingBoxes.map((box) => (
                  <g
                    key={box.id}
                    className="cursor-grab"
                    onMouseDown={(e) => beginAssetDrag(e, box)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!moved.current) setSelectedAssetId(box.id);
                    }}
                  >
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.w}
                      height={box.h}
                      rx={0.2}
                      fill="#1e1b4b"
                      stroke={selectedAssetId === box.id ? "#e8a838" : "#818cf8"}
                      strokeWidth={selectedAssetId === box.id ? 0.32 : 0.18}
                    />
                    <text
                      x={box.x + box.w / 2}
                      y={box.y + box.h / 2 + 0.5}
                      textAnchor="middle"
                      fill="#c7d2fe"
                      fontSize={1}
                    >
                      {box.label}
                    </text>
                  </g>
                ))}
                {model.dimensions.map((d) => (
                  <DimensionLine key={d.id} dim={d} />
                ))}
              </g>
            </g>
          </svg>
          <NorthIndicator />
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-line bg-panel/90 px-3 py-2 text-[11px] text-muted">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-block h-px w-10 bg-muted" />
              <span>{(50).toFixed(0)} m</span>
            </div>
            <svg width={50 * scale} height="8" className="max-w-[180px]">
              <line x1="0" y1="4" x2={50 * scale} y2="4" stroke="#8b93a7" strokeWidth="2" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#8b93a7" strokeWidth="2" />
              <line
                x1={50 * scale}
                y1="0"
                x2={50 * scale}
                y2="8"
                stroke="#8b93a7"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-auto border-l border-line bg-panel p-4">
        <h2 className="text-[15px] font-medium">Sub-blocks</h2>
        <p className="mt-1 text-[12px] text-muted">
          Sub-blocks are the children of this inverter in Config / Conceptual — including
          quantity and each child’s own tree. Drag the title bar to move a sub-block, or drag
          trackers and boxes inside it.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-line px-2 py-2 text-[12px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={snapGrid}
            onChange={(e) => setSnapGrid(e.target.checked)}
          />
          <span>
            <span className="block font-medium">Grid</span>
            <span className="block text-[11px] text-muted">
              Same as the toolbar button. Trackers snap E–W to pitch (
              {trackerGrid.colPitch.toFixed(1)} m) and N–S to the Config N–S distance (
              {trackerGrid.rowPitch.toFixed(1)} m). A drop in the middle of a cell rounds to the
              nearest slot. Turn Grid off for free placement.
            </span>
          </span>
        </label>
        <div className="mt-2">
          <Button variant="default" onClick={alignTrackersToGrid}>
            Align {selectedSub ? "selected" : "all"} trackers to grid
          </Button>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-line px-2 py-2 text-[12px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={applyToType}
            onChange={(e) => setApplyToType(e.target.checked)}
          />
          <span>
            <span className="block font-medium">
              {selectedSub && typeSiblings.length > 1
                ? `Apply inner edits to all ${typeSiblings.length} of this type`
                : "Apply inner edits to all of this type"}
            </span>
            <span className="block text-[11px] text-muted">
              Positions are relative to each sub-block origin. When on, dragging a tracker or
              box copies that inner layout to every sub-block from the same Config child. When
              off, only this instance changes.
            </span>
          </span>
        </label>
        <div className="mt-3 space-y-1">
          {model.subBlocks.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setSelectedSubId(sub.id);
                setSelectedId(null);
              }}
              className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left ${
                selectedSubId === sub.id ? "border-warn bg-raised" : "border-line hover:bg-raised/60"
              }`}
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: frameColor(sub.kind) }}
              />
              <span>
                <span className="block text-[12px] font-medium">{sub.label}</span>
                <span className="block text-[11px] text-muted">{sub.detail}</span>
              </span>
            </button>
          ))}
        </div>
        {selectedSub ? (
          <Card className="mt-3 px-3 py-2">
            <div className="text-[12px] font-medium">{selectedSub.label}</div>
            <div className="font-mono text-[12px] text-muted">
              {selectedSub.originX.toFixed(1)}, {selectedSub.originY.toFixed(1)} m
            </div>
            <p className="mt-1 text-[11px] text-muted">{selectedSub.detail}</p>
            {typeSiblings.length > 1 ? (
              <Button
                className="mt-2"
                variant="ghost"
                onClick={() => {
                  const poses = innerPosesOf(model, selectedSub);
                  commitInner(selectedSub.id, selectedSub.typeId, poses, true);
                }}
              >
                Copy inner layout to all {typeSiblings.length} of this type
              </Button>
            ) : null}
            <Button
              className="mt-1"
              variant="ghost"
              onClick={() =>
                onPatchBlock({
                  subblock_inner: (block.subblock_inner ?? []).filter(
                    (x) => x.sub_id !== selectedSub.id,
                  ),
                })
              }
            >
              Reset this sub-block’s inner layout
            </Button>
          </Card>
        ) : null}
        <Button
          className="mt-3"
          variant="ghost"
          onClick={() => commitPoses([])}
        >
          Reset sub-block positions
        </Button>
        <Button
          className="mt-1"
          variant="ghost"
          onClick={() =>
            onPatchBlock({ subblock_inner: [], subblock_type_inner: [] })
          }
        >
          Reset all inner layouts
        </Button>

        <h2 className="mt-6 text-[15px] font-medium">Cable runs & distances</h2>
        <p className="mt-1 text-[12px] text-muted">
          Lengths are trench (Manhattan) distances in metres. Moving a sub-block or an asset
          inside it updates L0/L1.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Trackers" value={String(t.trackerCount)} />
          <Stat label="Sub-blocks" value={String(model.subBlocks.length)} />
          <Stat label="String boxes" value={String(t.stringBoxCount)} />
          <Stat label="Switching boxes" value={String(t.switchingBoxCount)} />
          <Stat label="Pitch" value={`${model.pitch_m.toFixed(1)} m`} />
          <Stat label="N–S gap" value={`${model.rowGap_m.toFixed(1)} m`} />
          <Stat label="L0 total" value={`${t.l0Length_m.toFixed(0)} m`} />
          <Stat label="L0 × circuits" value={`${t.l0Circuit_m.toFixed(0)} m`} />
          <Stat label="L0 min / max" value={`${t.minL0_m.toFixed(1)} / ${t.maxL0_m.toFixed(1)} m`} />
          <Stat label="L0 average" value={`${t.avgL0_m.toFixed(1)} m`} />
          <Stat label="L1 total" value={`${t.l1Length_m.toFixed(0)} m`} />
        </div>
        <div className="mt-4 space-y-1 text-[11px] text-muted">
          <div>
            Tracker {model.tableLength_m.toFixed(1)} × {model.tableWidth_m.toFixed(1)} m
            {model.trackerAsset ? ` · ${model.trackerAsset.name}` : ""}
          </div>
          <div>
            L0 {model.l0Asset?.name ?? "DC L0"} · L1 {model.l1Asset?.name ?? "DC L1"}
          </div>
          <div className="flex gap-3 pt-1">
            <span className="inline-flex items-center gap-1">
              <span className="h-px w-4" style={{ background: L0 }} /> L0
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-px w-4" style={{ background: L1 }} /> L1
            </span>
          </div>
        </div>

        {selected ? (
          <Card className="mt-4 px-3 py-2">
            <div className="text-[12px] font-medium">
              {selected.kind === "dc_l0" ? "DC L0 run" : "DC L1 run"}
            </div>
            <div className="font-mono text-[13px]">{selected.length_m.toFixed(2)} m</div>
            <div className="text-[11px] text-muted">
              {selected.fromId} → {selected.toId}
              {selected.circuits > 1 ? ` · ${selected.circuits} circuits` : ""}
            </div>
          </Card>
        ) : (
          <p className="mt-4 text-[12px] text-muted">Click a cable to read its length.</p>
        )}

        <h3 className="mt-5 text-[12px] uppercase tracking-wide text-muted">L1 schedule</h3>
        <table className="mt-1 w-full text-left text-[12px]">
          <thead className="text-[10px] uppercase text-muted">
            <tr>
              <th className="py-1 font-medium">From</th>
              <th className="py-1 font-medium">To</th>
              <th className="py-1 text-right font-medium">m</th>
            </tr>
          </thead>
          <tbody>
            {model.runs
              .filter((r) => r.kind === "dc_l1")
              .map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer border-t border-line ${
                    selectedId === r.id ? "text-accent" : ""
                  }`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td className="py-1">{labelOf(model, r.fromId)}</td>
                  <td className="py-1">{labelOf(model, r.toId)}</td>
                  <td className="py-1 text-right font-mono">{r.length_m.toFixed(1)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </aside>
    </div>
  );
}

function labelOf(model: ReturnType<typeof buildBlockDetail>, id: string): string {
  return (
    model.trackers.find((t) => t.id === id)?.label ??
    model.stringBoxes.find((t) => t.id === id)?.label ??
    model.switchingBoxes.find((t) => t.id === id)?.label ??
    id
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-[13px]">{value}</div>
    </Card>
  );
}

function TrackerSnapGrid({
  sub,
  grid,
}: {
  sub: DetailSubBlock;
  grid: TrackerGrid;
}) {
  const col = grid.colPitch;
  const row = grid.rowPitch;
  if (!(col > 0) || !(row > 0)) return null;
  const ox = sub.originX + grid.originX;
  const oy = sub.originY + grid.originY;
  const padX = col * 2;
  const padY = row * 2;
  const x0 = sub.x - padX;
  const x1 = sub.x + sub.w + padX;
  const y0 = sub.y - padY;
  const y1 = sub.y + sub.h + padY;
  const n0 = Math.floor((x0 - ox) / col);
  const n1 = Math.ceil((x1 - ox) / col);
  const m0 = Math.floor((y0 - oy) / row);
  const m1 = Math.ceil((y1 - oy) / row);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let n = n0; n <= n1 && xs.length < 80; n++) xs.push(ox + n * col);
  for (let m = m0; m <= m1 && ys.length < 80; m++) ys.push(oy + m * row);
  const showDots = xs.length * ys.length <= 400;
  return (
    <g pointerEvents="none" opacity={0.75}>
      {xs.map((x) => (
        <line
          key={`v${x}`}
          x1={x}
          y1={y0}
          x2={x}
          y2={y1}
          stroke="#3dcc8c"
          strokeWidth={0.28}
          strokeDasharray="1.2 1.4"
        />
      ))}
      {ys.map((y) => (
        <line
          key={`h${y}`}
          x1={x0}
          y1={y}
          x2={x1}
          y2={y}
          stroke="#3dcc8c"
          strokeWidth={0.28}
          strokeDasharray="1.2 1.4"
        />
      ))}
      {showDots
        ? xs.flatMap((x) =>
            ys.map((y) => (
              <circle key={`p${x}:${y}`} cx={x} cy={y} r={0.45} fill="#3dcc8c" />
            )),
          )
        : null}
    </g>
  );
}

function CablePath({
  run,
  selected,
  onSelect,
}: {
  run: DetailRun;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = run.kind === "dc_l0" ? L0 : L1;
  const mid = run.points[Math.floor(run.points.length / 2)];
  const showLabel = selected || run.kind === "dc_l1";
  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="cursor-pointer"
    >
      <path
        d={polyline(run.points)}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 0.45 : run.kind === "dc_l1" ? 0.28 : 0.12}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={selected || run.kind === "dc_l1" ? 1 : 0.55}
      />
      {showLabel && mid ? (
        <text x={mid.x + 0.4} y={mid.y - 0.4} fill={color} fontSize={1.3}>
          {run.length_m.toFixed(1)} m
        </text>
      ) : null}
    </g>
  );
}

function DimensionLine({
  dim,
}: {
  dim: { x1: number; y1: number; x2: number; y2: number; offset: number; label: string };
}) {
  const dx = dim.x2 - dim.x1;
  const dy = dim.y2 - dim.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * dim.offset;
  const ny = (dx / len) * dim.offset;
  const a = { x: dim.x1 + nx, y: dim.y1 + ny };
  const b = { x: dim.x2 + nx, y: dim.y2 + ny };
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return (
    <g fill="none" stroke="#e8a838" strokeWidth={0.12} pointerEvents="none">
      <line x1={dim.x1} y1={dim.y1} x2={a.x} y2={a.y} />
      <line x1={dim.x2} y1={dim.y2} x2={b.x} y2={b.y} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <text x={mx} y={my - 0.5} fill="#e8a838" fontSize={1.8} textAnchor="middle" stroke="none">
        {dim.label}
      </text>
    </g>
  );
}
