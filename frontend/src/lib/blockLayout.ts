import { exactGrid } from "./reconcile";
import { projectParameters } from "./parameters";
import {
  countKindUnder,
  firstOfKind,
  inverterSubBlockSpecs,
  treeForSource,
} from "./topology";
import type {
  AssetDefinition,
  InnerAssetPose,
  Project,
  SubBlockInnerLayout,
  SubBlockPose,
  SubBlockTypeInnerLayout,
  TrackerBlock,
} from "../types/project";

export interface DetailRect {
  id: string;
  localKey: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetailRun {
  id: string;
  kind: "dc_l0" | "dc_l1";
  fromId: string;
  toId: string;
  length_m: number;
  circuits: number;
  points: { x: number; y: number }[];
}

export interface DetailDimension {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
}

export interface DetailSubBlock {
  id: string;
  index: number;
  label: string;
  detail: string;
  kind: "switching" | "string" | "row";
  typeId: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  trackerIds: string[];
  stringBoxIds: string[];
  switchingBoxId: string | null;
}

export interface BlockDetailDraft {
  poses?: SubBlockPose[];
  innerInstance?: Record<string, InnerAssetPose[]>;
  innerType?: Record<string, InnerAssetPose[]>;
}

export interface BlockDetailModel {
  blockName: string;
  orientation: TrackerBlock["orientation"];
  tableLength_m: number;
  tableWidth_m: number;
  pitch_m: number;
  rowGap_m: number;
  trackerGrid: TrackerGrid;
  trackersPerStringBox: number;
  stringBoxesPerSwitchingBox: number;
  l0Circuits: number;
  trackerAsset: AssetDefinition | null;
  stringBoxAsset: AssetDefinition | null;
  switchingBoxAsset: AssetDefinition | null;
  l0Asset: AssetDefinition | null;
  l1Asset: AssetDefinition | null;
  subBlocks: DetailSubBlock[];
  trackers: DetailRect[];
  stringBoxes: DetailRect[];
  switchingBoxes: DetailRect[];
  runs: DetailRun[];
  dimensions: DetailDimension[];
  bounds: { w: number; h: number };
  totals: {
    trackerCount: number;
    stringBoxCount: number;
    switchingBoxCount: number;
    l0Length_m: number;
    l1Length_m: number;
    l0Circuit_m: number;
    maxL0_m: number;
    minL0_m: number;
    avgL0_m: number;
  };
}

function manhattanLength(points: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    n += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return n;
}

export function snapMetres(v: number, step = 0.5): number {
  return Math.round(v / step) * step;
}

export interface TrackerGrid {
  originX: number;
  originY: number;
  colPitch: number;
  rowPitch: number;
}

export function snapToTrackerGrid(
  x: number,
  y: number,
  grid: TrackerGrid,
): { x: number; y: number } {
  const snapAxis = (v: number, origin: number, step: number) => {
    if (!(step > 0)) return v;
    return origin + Math.round((v - origin) / step) * step;
  };
  return {
    x: snapAxis(x, grid.originX, grid.colPitch),
    y: snapAxis(y, grid.originY, grid.rowPitch),
  };
}

export function snapTrackerPoses(
  poses: InnerAssetPose[],
  grid: TrackerGrid,
): InnerAssetPose[] {
  return poses.map((p) => {
    if (!p.key.startsWith("trk-")) return p;
    const s = snapToTrackerGrid(p.x, p.y, grid);
    return { ...p, x: s.x, y: s.y };
  });
}

function applyLocalPoses(rects: DetailRect[], poses: InnerAssetPose[] | undefined) {
  if (!poses?.length) return;
  const map = new Map(poses.map((p) => [p.key, p]));
  for (const r of rects) {
    const p = map.get(r.localKey);
    if (!p) continue;
    r.x = p.x;
    r.y = p.y;
  }
}

function resolveInnerPoses(
  specId: string,
  typeId: string,
  block: TrackerBlock,
  draft?: BlockDetailDraft,
): InnerAssetPose[] | undefined {
  const draftedInstance = draft?.innerInstance?.[specId];
  if (draftedInstance) return draftedInstance;
  const draftedType = draft?.innerType?.[typeId];
  if (draftedType) return draftedType;
  const storedInstance = block.subblock_inner?.find((x) => x.sub_id === specId);
  if (storedInstance?.poses?.length) return storedInstance.poses;
  const storedType = block.subblock_type_inner?.find((x) => x.type_id === typeId);
  if (storedType?.poses?.length) return storedType.poses;
  return undefined;
}

export function upsertInstanceInner(
  list: SubBlockInnerLayout[] | undefined,
  subId: string,
  poses: InnerAssetPose[],
): SubBlockInnerLayout[] {
  return [...(list ?? []).filter((x) => x.sub_id !== subId), { sub_id: subId, poses }];
}

export function upsertTypeInner(
  list: SubBlockTypeInnerLayout[] | undefined,
  typeId: string,
  poses: InnerAssetPose[],
): SubBlockTypeInnerLayout[] {
  return [...(list ?? []).filter((x) => x.type_id !== typeId), { type_id: typeId, poses }];
}

export function clearInstanceInnerForIds(
  list: SubBlockInnerLayout[] | undefined,
  subIds: string[],
): SubBlockInnerLayout[] {
  const drop = new Set(subIds);
  return (list ?? []).filter((x) => !drop.has(x.sub_id));
}

export function innerPosesOf(model: BlockDetailModel, sub: DetailSubBlock): InnerAssetPose[] {
  const ox = sub.originX;
  const oy = sub.originY;
  const out: InnerAssetPose[] = [];
  const add = (r: DetailRect | undefined) => {
    if (!r) return;
    out.push({ key: r.localKey, x: r.x - ox, y: r.y - oy });
  };
  for (const id of sub.trackerIds) add(model.trackers.find((t) => t.id === id));
  for (const id of sub.stringBoxIds) add(model.stringBoxes.find((t) => t.id === id));
  if (sub.switchingBoxId) {
    add(model.switchingBoxes.find((t) => t.id === sub.switchingBoxId));
  }
  return out;
}

function typeLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

function kindTag(
  kind: AssetDefinition["kind"] | undefined,
): DetailSubBlock["kind"] {
  if (kind === "switching_box") return "switching";
  if (kind === "string_box") return "string";
  return "row";
}

function kindPrefix(kind: DetailSubBlock["kind"]): string {
  if (kind === "switching") return "SW";
  if (kind === "string") return "SB";
  return "Row";
}

export function buildBlockDetail(
  block: TrackerBlock,
  project: Project,
  draft?: BlockDetailDraft,
): BlockDetailModel {
  const tree = treeForSource(project, block.source_id);
  const trackerHit = firstOfKind(tree, project.catalog, "tracker");
  const sbHit = firstOfKind(tree, project.catalog, "string_box");
  const swHit = firstOfKind(tree, project.catalog, "switching_box");
  const trackerAsset = trackerHit?.asset ?? null;
  const tableLength =
    trackerAsset?.table_length_m && trackerAsset.table_length_m > 0
      ? trackerAsset.table_length_m
      : 64;
  const tableWidth =
    trackerAsset?.table_width_m && trackerAsset.table_width_m > 0
      ? trackerAsset.table_width_m
      : 2.4;
  const params = projectParameters(project);
  const pitch = params.tracker_pitch_m;
  const rowGap = params.tracker_ns_gap_m;
  const ns = block.orientation === "NS";
  const tw = ns ? tableWidth : tableLength;
  const th = ns ? tableLength : tableWidth;
  const colPitch = ns ? pitch : tableLength + rowGap;
  const rowPitch = ns ? tableLength + rowGap : pitch;

  const tpi = tree ? countKindUnder(tree, project.catalog, "tracker") : 0;
  const invertersHere =
    tpi > 0
      ? Math.max(1, Math.round((block.rows * block.trackers_per_row) / tpi) || 1)
      : 1;
  const baseSpecs = inverterSubBlockSpecs(tree, project.catalog);
  const specs =
    baseSpecs.length === 0
      ? []
      : invertersHere === 1
        ? baseSpecs
        : Array.from({ length: invertersHere }, (_, copy) =>
            baseSpecs.map((s) => ({ ...s, id: `${s.id}-i${copy}` })),
          ).flat();

  const poses = draft?.poses ?? block.subblock_poses ?? [];
  const poseMap = new Map(poses.map((p) => [p.id, p]));

  const pad = 2.2;
  const titleH = 3.2;
  const sbW = 1.6;
  const sbH = 1.2;
  const swW = 2.4;
  const swH = 1.8;
  const swLane = 8;

  const trackers: DetailRect[] = [];
  const stringBoxes: DetailRect[] = [];
  const switchingBoxes: DetailRect[] = [];
  const subBlocks: DetailSubBlock[] = [];
  const runs: DetailRun[] = [];
  let cursorY = 4;
  let trackerSerial = 0;

  const fallbackTrackers = Math.max(1, block.rows * block.trackers_per_row);
  const worklist =
    specs.length > 0
      ? specs
      : [
          {
            id: "sub-0",
            typeIndex: 0,
            instance: 0,
            typeCount: 1,
            typeId: "root",
            node: tree,
            asset: trackerAsset,
            trackers: fallbackTrackers,
            stringBoxes: 0,
            switchingBoxes: 0,
            modules: 0,
          },
        ];

  worklist.forEach((spec, index) => {
    const childTracker = spec.node
      ? firstOfKind(spec.node, project.catalog, "tracker")
      : trackerHit;
    const childSb = spec.node ? firstOfKind(spec.node, project.catalog, "string_box") : sbHit;
    const n = Math.max(0, spec.trackers);
    const sbCount = Math.max(0, spec.stringBoxes);
    const trackersPerSb = sbCount > 0 && n > 0 ? Math.max(1, Math.round(n / sbCount)) : Math.max(1, childTracker?.node.quantity_per_parent ?? 1);
    const prefer = Math.min(Math.max(1, n || 1), trackersPerSb);
    const grid = exactGrid(Math.max(1, n || 1), prefer);
    const tag = kindTag(spec.asset?.kind);
    const letter = typeLetter(spec.typeIndex);
    const multiType = new Set(worklist.map((s) => s.typeIndex)).size > 1;
    const label = multiType
      ? `${kindPrefix(tag)}-${letter}${spec.instance + 1}`
      : `${kindPrefix(tag)}-${spec.instance + 1}`;
    const l0Circuits = Math.max(1, childTracker?.node.cable_quantity ?? 1);
    const l1Circuits = Math.max(1, childSb?.node.cable_quantity ?? 1);

    const localTrackers: DetailRect[] = [];
    const count = Math.max(n, n === 0 && sbCount === 0 && spec.switchingBoxes === 0 ? 1 : n);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.trackers_per_row; c++) {
        if (localTrackers.length >= count) break;
        const gi = trackerSerial++;
        localTrackers.push({
          id: `trk-${spec.id}-${gi}`,
          localKey: `trk-${localTrackers.length}`,
          label: `${label}.T${r + 1}.${c + 1}`,
          x: swLane + c * colPitch,
          y: titleH + pad + r * rowPitch,
          w: tw,
          h: th,
        });
      }
    }
    if (n === 0) localTrackers.length = 0;

    const sbGroups = new Map<number, DetailRect[]>();
    localTrackers.forEach((trk, ti) => {
      const g = Math.floor(ti / trackersPerSb);
      const list = sbGroups.get(g) ?? [];
      list.push(trk);
      sbGroups.set(g, list);
    });
    if (sbCount > 0 && localTrackers.length === 0) {
      sbGroups.set(0, []);
    }

    const localSbs: DetailRect[] = [];
    const targetSbs = Math.max(sbCount, sbGroups.size);
    for (let g = 0; g < targetSbs; g++) {
      const list = sbGroups.get(g) ?? [];
      const minX = list.length ? Math.min(...list.map((t) => t.x)) : swLane;
      const maxX = list.length ? Math.max(...list.map((t) => t.x + t.w)) : swLane + tw;
      const maxY = list.length ? Math.max(...list.map((t) => t.y + t.h)) : titleH + pad + th;
      localSbs.push({
        id: `sb-${spec.id}-${g}`,
        localKey: `sb-${g}`,
        label: `${label}.SB${g + 1}`,
        x: (minX + maxX) / 2 - sbW / 2,
        y: maxY + 1.4,
        w: sbW,
        h: sbH,
      });
    }

    const hasSw = spec.switchingBoxes > 0 || spec.asset?.kind === "switching_box";
    const contentRight = Math.max(
      ...localTrackers.map((t) => t.x + t.w),
      ...localSbs.map((b) => b.x + b.w),
      swLane + 4,
    );
    const contentBottom = Math.max(
      ...localTrackers.map((t) => t.y + t.h),
      ...localSbs.map((b) => b.y + b.h),
      titleH + 8,
    );
    const contentTop = localTrackers.length
      ? Math.min(...localTrackers.map((t) => t.y))
      : titleH + pad;
    const localSw: DetailRect | null = hasSw
      ? {
          id: `sw-${spec.id}`,
          localKey: "sw",
          label: `${label}.SW`,
          x: 1.2,
          y: (contentTop + contentBottom) / 2 - swH / 2,
          w: swW,
          h: swH,
        }
      : null;

    const typeId = spec.typeId ?? "root";
    const inner = resolveInnerPoses(spec.id, typeId, block, draft);
    applyLocalPoses(localTrackers, inner);
    applyLocalPoses(localSbs, inner);
    if (localSw) applyLocalPoses([localSw], inner);

    const locals = [
      ...localTrackers,
      ...localSbs,
      ...(localSw ? [localSw] : []),
    ];
    const minLocalX = locals.length ? Math.min(0, ...locals.map((r) => r.x)) : 0;
    const minLocalY = locals.length ? Math.min(0, ...locals.map((r) => r.y)) : 0;
    const maxLocalX = locals.length
      ? Math.max(contentRight, ...locals.map((r) => r.x + r.w))
      : Math.max(contentRight, 20);
    const maxLocalY = locals.length
      ? Math.max(titleH, contentBottom, ...locals.map((r) => r.y + r.h))
      : Math.max(titleH + 8, contentBottom);
    const w = maxLocalX - minLocalX + pad;
    const h = maxLocalY - minLocalY + pad;
    const stored = poseMap.get(spec.id);
    const originX = stored?.x ?? 4;
    const originY = stored?.y ?? cursorY;
    const x = originX + minLocalX;
    const y = originY + minLocalY;
    cursorY = Math.max(cursorY, originY + h + 6);

    const shift = (rect: DetailRect): DetailRect => ({
      ...rect,
      x: rect.x + originX,
      y: rect.y + originY,
    });
    const worldTrackers = localTrackers.map(shift);
    const worldSbs = localSbs.map(shift);
    const worldSw = localSw ? shift(localSw) : null;
    trackers.push(...worldTrackers);
    stringBoxes.push(...worldSbs);
    if (worldSw) switchingBoxes.push(worldSw);

    const parts = [
      `${spec.trackers} tracker${spec.trackers === 1 ? "" : "s"}`,
      `${spec.stringBoxes} string box${spec.stringBoxes === 1 ? "" : "es"}`,
    ];
    if (spec.modules) parts.push(`${spec.modules.toLocaleString()} modules`);
    if (spec.asset?.name) parts.push(spec.asset.name);

    subBlocks.push({
      id: spec.id,
      index,
      label,
      detail: parts.join(" · "),
      kind: tag,
      typeId,
      originX,
      originY,
      x,
      y,
      w,
      h,
      trackerIds: worldTrackers.map((t) => t.id),
      stringBoxIds: worldSbs.map((b) => b.id),
      switchingBoxId: worldSw?.id ?? null,
    });

    worldSbs.forEach((sb, gi) => {
      const group = worldTrackers.slice(gi * trackersPerSb, (gi + 1) * trackersPerSb);
      const sbIn = { x: sb.x + sb.w / 2, y: sb.y };
      for (const trk of group) {
        const start = { x: trk.x + trk.w / 2, y: trk.y + trk.h };
        const trenchY = sb.y - 0.5;
        const points = [start, { x: start.x, y: trenchY }, { x: sbIn.x, y: trenchY }, sbIn];
        runs.push({
          id: `l0-${trk.id}`,
          kind: "dc_l0",
          fromId: trk.id,
          toId: sb.id,
          length_m: manhattanLength(points),
          circuits: l0Circuits,
          points,
        });
      }
      if (worldSw) {
        const start = { x: sb.x, y: sb.y + sb.h / 2 };
        const viaX = worldSw.x + worldSw.w;
        const end = { x: viaX, y: worldSw.y + worldSw.h / 2 };
        const points = [start, { x: viaX, y: start.y }, end];
        runs.push({
          id: `l1-${sb.id}`,
          kind: "dc_l1",
          fromId: sb.id,
          toId: worldSw.id,
          length_m: manhattanLength(points),
          circuits: l1Circuits,
          points,
        });
      }
    });
  });

  const l0Asset = trackerHit?.node.cable_asset_id
    ? (project.catalog.find((a) => a.id === trackerHit.node.cable_asset_id) ?? null)
    : (project.catalog.find((a) => a.kind === "dc_cable_l0") ?? null);
  const l1Asset = sbHit?.node.cable_asset_id
    ? (project.catalog.find((a) => a.id === sbHit.node.cable_asset_id) ?? null)
    : (project.catalog.find((a) => a.kind === "dc_cable_l1") ?? null);

  const l0s = runs.filter((r) => r.kind === "dc_l0");
  const l1s = runs.filter((r) => r.kind === "dc_l1");
  const l0Lens = l0s.map((r) => r.length_m);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const dimensions: DetailDimension[] = [];
  const first = subBlocks[0];
  const firstTrackers = first
    ? trackers.filter((t) => first.trackerIds.includes(t.id))
    : [];
  if (firstTrackers.length >= 2) {
    const a = firstTrackers[0];
    const b = firstTrackers[1];
    dimensions.push({
      id: "dim-pitch",
      label: `Pitch ${pitch.toFixed(1)} m`,
      x1: a.x + a.w / 2,
      y1: a.y,
      x2: b.x + b.w / 2,
      y2: b.y,
      offset: -6,
    });
  }
  if (firstTrackers[0]) {
    const a = firstTrackers[0];
    const south = firstTrackers
      .filter((t) => t.id !== a.id && Math.abs(t.x - a.x) < 0.5 && t.y > a.y)
      .sort((l, r) => l.y - r.y)[0];
    if (south) {
      dimensions.push({
        id: "dim-ns",
        label: ns
          ? `N–S ${rowGap.toFixed(1)} m`
          : `End gap ${rowGap.toFixed(1)} m`,
        x1: a.x + a.w / 2,
        y1: a.y + a.h,
        x2: south.x + south.w / 2,
        y2: south.y,
        offset: 6,
      });
    }
  }
  if (firstTrackers[0]) {
    const t = firstTrackers[0];
    dimensions.push({
      id: "dim-len",
      label: ns ? `Table ${tableLength.toFixed(1)} m N–S` : `Table ${tableLength.toFixed(1)} m E–W`,
      x1: t.x,
      y1: t.y,
      x2: t.x,
      y2: t.y + t.h,
      offset: -5,
    });
    dimensions.push({
      id: "dim-wid",
      label: `${tableWidth.toFixed(1)} m`,
      x1: t.x,
      y1: t.y + t.h,
      x2: t.x + t.w,
      y2: t.y + t.h,
      offset: 3.5,
    });
  }

  const maxX = Math.max(...subBlocks.map((s) => s.x + s.w), 40);
  const maxY = Math.max(...subBlocks.map((s) => s.y + s.h), 40);
  const treeTrackerPerSb = Math.max(1, trackerHit?.node.quantity_per_parent ?? 4);
  const treeSbsPerSw = Math.max(1, sbHit?.node.quantity_per_parent ?? 1);
  const treeL0 = Math.max(1, trackerHit?.node.cable_quantity ?? 1);

  return {
    blockName: block.name,
    orientation: block.orientation,
    tableLength_m: tableLength,
    tableWidth_m: tableWidth,
    pitch_m: pitch,
    rowGap_m: rowGap,
    trackerGrid: {
      originX: swLane,
      originY: titleH + pad,
      colPitch: pitch,
      rowPitch: rowGap > 0 ? rowGap : 1,
    },
    trackersPerStringBox: treeTrackerPerSb,
    stringBoxesPerSwitchingBox: treeSbsPerSw,
    l0Circuits: treeL0,
    trackerAsset,
    stringBoxAsset: sbHit?.asset ?? null,
    switchingBoxAsset: swHit?.asset ?? null,
    l0Asset,
    l1Asset,
    subBlocks,
    trackers,
    stringBoxes,
    switchingBoxes,
    runs,
    dimensions,
    bounds: { w: maxX + 16, h: maxY + 16 },
    totals: {
      trackerCount: trackers.length,
      stringBoxCount: stringBoxes.length,
      switchingBoxCount: switchingBoxes.length,
      l0Length_m: sum(l0Lens),
      l1Length_m: sum(l1s.map((r) => r.length_m)),
      l0Circuit_m: sum(l0Lens.map((len, i) => len * (l0s[i]?.circuits ?? 1))),
      maxL0_m: l0Lens.length ? Math.max(...l0Lens) : 0,
      minL0_m: l0Lens.length ? Math.min(...l0Lens) : 0,
      avgL0_m: l0Lens.length ? sum(l0Lens) / l0Lens.length : 0,
    },
  };
}

export function polyline(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}
