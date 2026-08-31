import { uid } from "./ids";
import { reconcileProject, stationRole } from "./reconcile";
import {
  asForest,
  setRootQuantity,
  trackersPerInverter,
} from "./topology";
import type { InverterStation, Project, TopologyNode } from "../types/project";

function bumpRoot(project: Project, rootId: string, delta: number): Project {
  const forest = asForest(project.topology);
  const root = forest.find((r) => r.id === rootId);
  if (!root) return project;
  return {
    ...project,
    topology: setRootQuantity(forest, rootId, root.quantity_per_parent + delta),
  };
}

function lastRoot(project: Project): TopologyNode | null {
  const forest = asForest(project.topology);
  return forest[forest.length - 1] ?? null;
}

export function addTrackerBlock(project: Project, x: number, y: number): Project {
  const root = lastRoot(project);
  if (!root || !trackersPerInverter(project, root.id)) return project;
  const reconciled = reconcileProject(bumpRoot(project, root.id, 1));
  const ofSource = reconciled.layout.blocks.filter((b) => b.source_id === root.id);
  const last = ofSource[ofSource.length - 1];
  if (!last) return reconciled;
  return {
    ...reconciled,
    layout: {
      ...reconciled.layout,
      blocks: reconciled.layout.blocks.map((b) =>
        b.id === last.id ? { ...b, x, y } : b,
      ),
    },
  };
}

export function addInverterStation(project: Project, x: number, y: number): Project {
  const root = lastRoot(project);
  if (!root || !trackersPerInverter(project, root.id)) return project;
  const reconciled = reconcileProject(bumpRoot(project, root.id, 1));
  const pcs = reconciled.layout.stations.filter(
    (s) => stationRole(s) === "pcs" && s.source_id === root.id,
  );
  const last = pcs[pcs.length - 1];
  if (!last) return reconciled;
  return {
    ...reconciled,
    layout: {
      ...reconciled.layout,
      stations: reconciled.layout.stations.map((s) =>
        s.id === last.id ? { ...s, x, y } : s,
      ),
    },
  };
}

export function addMvBus(project: Project, x: number, y: number): Project {
  const n =
    project.layout.stations.filter((s) => stationRole(s) === "mv").length + 1;
  const station: InverterStation = {
    id: uid("mv"),
    name: `MV bus ${n}`,
    x,
    y,
    inverter_count: 0,
    role: "mv",
  };
  return {
    ...project,
    layout: {
      ...project.layout,
      stations: [...project.layout.stations, station],
    },
  };
}

export function removeTrackerBlock(project: Project, blockId: string): Project {
  const block = project.layout.blocks.find((b) => b.id === blockId);
  if (!block) return project;
  const forest = asForest(project.topology);
  const rootId = block.source_id ?? forest[0]?.id;
  if (!rootId) return project;
  const tpi = trackersPerInverter(project, rootId);
  const trackers = block.rows * block.trackers_per_row;
  const invRemove = Math.max(1, Math.round(trackers / tpi));
  const next: Project = {
    ...bumpRoot(project, rootId, -invRemove),
    layout: {
      ...project.layout,
      blocks: project.layout.blocks.filter((b) => b.id !== blockId),
      cable_runs: project.layout.cable_runs.filter(
        (c) => c.from_id !== blockId && c.to_id !== blockId,
      ),
    },
  };
  return reconcileProject(next);
}

export function removeInverterStation(project: Project, stationId: string): Project {
  const station = project.layout.stations.find((s) => s.id === stationId);
  if (!station) return project;
  if (stationRole(station) === "mv") {
    return {
      ...project,
      layout: {
        ...project.layout,
        stations: project.layout.stations.filter((s) => s.id !== stationId),
        cable_runs: project.layout.cable_runs.filter(
          (c) => c.from_id !== stationId && c.to_id !== stationId,
        ),
      },
    };
  }
  const forest = asForest(project.topology);
  const rootId = station.source_id ?? forest[0]?.id;
  if (!rootId) return project;
  const next: Project = {
    ...bumpRoot(project, rootId, -Math.max(1, station.inverter_count)),
    layout: {
      ...project.layout,
      stations: project.layout.stations.filter((s) => s.id !== stationId),
      cable_runs: project.layout.cable_runs.filter(
        (c) => c.from_id !== stationId && c.to_id !== stationId,
      ),
    },
  };
  return reconcileProject(next);
}

export function setStationInverterCount(
  project: Project,
  stationId: string,
  count: number,
): Project {
  const station = project.layout.stations.find((s) => s.id === stationId);
  if (!station || stationRole(station) === "mv") return project;
  const nextCount = Math.max(0, count);
  const stations = project.layout.stations.map((s) =>
    s.id === stationId ? { ...s, inverter_count: nextCount } : s,
  );
  const forest = asForest(project.topology);
  const rootId = station.source_id ?? forest[0]?.id;
  if (!rootId) return project;
  const total = stations
    .filter(
      (s) =>
        stationRole(s) !== "mv" &&
        (s.source_id === rootId || (!s.source_id && forest.length === 1)),
    )
    .reduce((n, s) => n + s.inverter_count, 0);
  const next: Project = {
    ...project,
    topology: setRootQuantity(forest, rootId, total),
    layout: { ...project.layout, stations },
  };
  return reconcileProject(next);
}
