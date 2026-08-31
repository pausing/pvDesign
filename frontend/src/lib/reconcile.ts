import { uid } from "./ids";
import { projectParameters } from "./parameters";
import {
  asForest,
  countKindUnder,
  firstOfKind,
} from "./topology";
import type {
  CableRun,
  InverterStation,
  Layout,
  Project,
  TrackerBlock,
} from "../types/project";

export function splitInteger(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safe = weights.map((w) => Math.max(1, w));
  const sum = safe.reduce((a, b) => a + b, 0);
  const raw = safe.map((w) => (total * w) / sum);
  const floors = raw.map((v) => Math.floor(v));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  let k = 0;
  while (rem > 0 && n > 0) {
    out[order[k % n].i] += 1;
    rem -= 1;
    k += 1;
  }
  return out;
}

export function exactGrid(
  n: number,
  preferTpr: number,
): { rows: number; trackers_per_row: number } {
  if (n <= 0) return { rows: 1, trackers_per_row: 1 };
  const prefer = Math.max(1, preferTpr);
  if (n % prefer === 0) return { rows: n / prefer, trackers_per_row: prefer };
  let best = { rows: n, trackers_per_row: 1, score: Math.abs(1 - prefer) };
  for (let tpr = 1; tpr <= n; tpr++) {
    if (n % tpr !== 0) continue;
    const score = Math.abs(tpr - prefer);
    if (score < best.score) best = { rows: n / tpr, trackers_per_row: tpr, score };
  }
  return { rows: best.rows, trackers_per_row: best.trackers_per_row };
}

export function stationRole(station: InverterStation): "pcs" | "mv" {
  if (station.role === "mv") return "mv";
  // Named MV buses stay MV even when role was omitted or defaulted.
  if (station.inverter_count === 0 && /mv/i.test(station.name)) return "mv";
  return "pcs";
}

function groupCount(inverters: number): number {
  if (inverters <= 0) return 0;
  if (inverters <= 12) return inverters;
  return Math.min(8, inverters);
}

/**
 * Rebuild plant layout so blocks and PCS match the Config hierarchy.
 * Positions of kept nodes are preserved.
 */
export function syncLayoutFromTopology(project: Project): Layout {
  const layout = project.layout;
  const params = projectParameters(project);
  const forest = asForest(project.topology);
  const oldPcs = layout.stations.filter((s) => stationRole(s) === "pcs");
  const oldMv = layout.stations.filter((s) => stationRole(s) === "mv");

  const blocks: TrackerBlock[] = [];
  const pcsStations: InverterStation[] = [];
  let slot = 0;
  const unlabeled = forest.length === 1;

  for (const root of forest) {
    const qty = Math.max(0, root.quantity_per_parent);
    const tpi = countKindUnder(root, project.catalog, "tracker");
    const trackerHit = firstOfKind(root, project.catalog, "tracker");
    const preferTpr = Math.max(1, trackerHit?.node.quantity_per_parent ?? 4);
    const groups = groupCount(qty);
    const invShares =
      groups > 0 ? splitInteger(qty, Array.from({ length: groups }, () => 1)) : [];

    const prevBlocks = unlabeled
      ? layout.blocks
      : layout.blocks.filter((b) => b.source_id === root.id);
    const prevPcs = unlabeled
      ? oldPcs
      : oldPcs.filter((s) => s.source_id === root.id);

    for (let i = 0; i < groups; i++) {
      const prev = prevBlocks[i];
      const nTrackers = Math.round(invShares[i] * Math.max(1, tpi));
      const grid = exactGrid(Math.max(1, nTrackers), preferTpr);
      const col = slot % 4;
      const row = Math.floor(slot / 4);
      blocks.push({
        id: prev?.id ?? uid("blk"),
        name: prev?.name ?? `Block ${slot + 1}`,
        x: prev?.x ?? 40 + col * 380,
        y: prev?.y ?? 40 + row * 240,
        rows: grid.rows,
        trackers_per_row: grid.trackers_per_row,
        pitch_m: params.tracker_pitch_m,
        orientation: prev?.orientation ?? "NS",
        rotation_deg: prev?.rotation_deg ?? 0,
        source_id: root.id,
        subblock_poses: prev?.subblock_poses ?? [],
        subblock_inner: prev?.subblock_inner ?? [],
        subblock_type_inner: prev?.subblock_type_inner ?? [],
      });
      const prevSt = prevPcs[i];
      pcsStations.push({
        id: prevSt?.id ?? uid("st"),
        name: prevSt?.name ?? `PCS-${String(slot + 1).padStart(2, "0")}`,
        x: prevSt?.x ?? 220 + col * 380,
        y: prevSt?.y ?? 140 + row * 240,
        inverter_count: invShares[i],
        role: "pcs",
        source_id: root.id,
      });
      slot += 1;
    }
  }

  const stations: InverterStation[] = [...pcsStations];
  const anyMvCable = forest.some((r) => Boolean(r.cable_asset_id));
  if (oldMv.length > 0) {
    stations.push(
      ...oldMv.map((s) => ({
        ...s,
        inverter_count: 0,
        role: "mv" as const,
      })),
    );
  } else if (anyMvCable) {
    stations.push({
      id: uid("mv"),
      name: "MV bus",
      x: 200,
      y: 280,
      inverter_count: 0,
      role: "mv",
    });
  }

  const ids = new Set([
    ...blocks.map((b) => b.id),
    ...stations.map((s) => s.id),
  ]);
  const kept: CableRun[] = layout.cable_runs.filter(
    (c) => ids.has(c.from_id) && ids.has(c.to_id),
  );
  const cable_runs = ensurePlantCables(blocks, stations, kept);

  return { ...layout, blocks, stations, cable_runs };
}

function hasRun(runs: CableRun[], a: string, b: string): boolean {
  return runs.some(
    (c) =>
      (c.from_id === a && c.to_id === b) || (c.from_id === b && c.to_id === a),
  );
}

function ensurePlantCables(
  blocks: TrackerBlock[],
  stations: InverterStation[],
  existing: CableRun[],
): CableRun[] {
  const runs = [...existing];
  const pcs = stations.filter((s) => stationRole(s) === "pcs");
  const mv = stations.find((s) => stationRole(s) === "mv");
  for (let i = 0; i < Math.min(blocks.length, pcs.length); i++) {
    if (!hasRun(runs, blocks[i].id, pcs[i].id)) {
      runs.push({
        id: uid("run"),
        kind: "dc_l1",
        from_id: blocks[i].id,
        to_id: pcs[i].id,
        from_type: "block",
        to_type: "station",
      });
    }
  }
  if (mv) {
    for (const p of pcs) {
      if (!hasRun(runs, p.id, mv.id)) {
        runs.push({
          id: uid("run"),
          kind: "mv",
          from_id: p.id,
          to_id: mv.id,
          from_type: "station",
          to_type: "station",
        });
      }
    }
  }
  return runs;
}

function layoutFingerprint(layout: Layout): string {
  const blocks = layout.blocks
    .map((b) => `${b.id}:${b.rows}x${b.trackers_per_row}:${b.pitch_m}:${b.source_id ?? ""}`)
    .join(",");
  const stations = layout.stations
    .map((s) => `${s.id}:${s.inverter_count}:${stationRole(s)}:${s.source_id ?? ""}`)
    .join(",");
  const cables = [...layout.cable_runs]
    .map((c) => `${c.from_id}>${c.to_id}:${c.kind}`)
    .sort()
    .join(",");
  return `${blocks}|${stations}|${cables}`;
}

/** Layout is derived from the Config hierarchy (counts stay in the tree). */
export function reconcileProject(project: Project): Project {
  const layout = syncLayoutFromTopology(project);
  if (layoutFingerprint(layout) === layoutFingerprint(project.layout)) {
    return project;
  }
  return { ...project, layout };
}
