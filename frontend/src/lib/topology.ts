import { uid } from "./ids";
import type { AssetDefinition, AssetKind, Project, TopologyNode } from "../types/project";

export interface BomRow {
  assetId: string;
  name: string;
  kind: AssetKind;
  count: number;
  unit?: string;
}

export interface CheckItem {
  id: string;
  level: "ok" | "warn" | "fail";
  title: string;
  detail: string;
}

export interface PlantRollup {
  modules: number;
  trackers: number;
  stringBoxes: number;
  switchingBoxes: number;
  inverters: number;
  dcMwp: number;
  acMw: number;
  dcAc: number | null;
  bom: BomRow[];
  checks: CheckItem[];
}

function catalogMap(catalog: AssetDefinition[]): Map<string, AssetDefinition> {
  return new Map(catalog.map((a) => [a.id, a]));
}

export type TopologyInput = TopologyNode[] | TopologyNode | null | undefined;

export function asForest(topology: TopologyInput): TopologyNode[] {
  if (!topology) return [];
  return Array.isArray(topology) ? topology : [topology];
}

export function cloneNode(node: TopologyNode): TopologyNode {
  return {
    ...node,
    id: uid("node"),
    children: node.children.map(cloneNode),
  };
}

export function walkTopology(
  topology: TopologyInput,
): { counts: Map<string, number>; cables: Map<string, number>; instances: Map<string, number> } {
  const counts = new Map<string, number>();
  const cables = new Map<string, number>();
  const instances = new Map<string, number>();

  const visit = (n: TopologyNode, parentTotal: number) => {
    const total = parentTotal * n.quantity_per_parent;
    counts.set(n.asset_id, (counts.get(n.asset_id) ?? 0) + total);
    instances.set(n.id, total);
    if (n.cable_asset_id && n.cable_quantity) {
      cables.set(
        n.cable_asset_id,
        (cables.get(n.cable_asset_id) ?? 0) + total * n.cable_quantity,
      );
    }
    for (const child of n.children) visit(child, total);
  };

  for (const root of asForest(topology)) visit(root, 1);
  return { counts, cables, instances };
}

export function findNode(
  node: TopologyNode | null,
  id: string,
): TopologyNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findInForest(topology: TopologyInput, id: string): TopologyNode | null {
  for (const root of asForest(topology)) {
    const found = findNode(root, id);
    if (found) return found;
  }
  return null;
}

export function rootFor(topology: TopologyInput, id: string): TopologyNode | null {
  for (const root of asForest(topology)) {
    if (findNode(root, id)) return root;
  }
  return null;
}

export function treeForSource(project: Project, sourceId?: string | null): TopologyNode | null {
  const forest = asForest(project.topology);
  if (sourceId) return forest.find((r) => r.id === sourceId) ?? forest[0] ?? null;
  return forest[0] ?? null;
}

export function mapTopology(
  node: TopologyNode,
  id: string,
  fn: (n: TopologyNode) => TopologyNode,
): TopologyNode {
  if (node.id === id) return fn(node);
  return {
    ...node,
    children: node.children.map((c) => mapTopology(c, id, fn)),
  };
}

export function removeTopologyNode(node: TopologyNode, id: string): TopologyNode | null {
  if (node.id === id) return null;
  return {
    ...node,
    children: node.children
      .map((c) => removeTopologyNode(c, id))
      .filter((c): c is TopologyNode => c !== null),
  };
}

export function firstOfKind(
  topology: TopologyInput,
  catalog: AssetDefinition[],
  kind: AssetKind,
): { node: TopologyNode; asset: AssetDefinition } | null {
  const byId = catalogMap(catalog);
  const walk = (n: TopologyNode): { node: TopologyNode; asset: AssetDefinition } | null => {
    const asset = byId.get(n.asset_id);
    if (asset?.kind === kind) return { node: n, asset };
    for (const child of n.children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const root of asForest(topology)) {
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

export function countKindUnder(
  node: TopologyNode,
  catalog: AssetDefinition[],
  kind: AssetKind,
): number {
  const byId = catalogMap(catalog);
  const rec = (n: TopologyNode): number => {
    const asset = byId.get(n.asset_id);
    let total = asset?.kind === kind ? 1 : 0;
    for (const child of n.children) {
      total += child.quantity_per_parent * rec(child);
    }
    return total;
  };
  return rec(node);
}

export interface InverterSubBlockSpec {
  id: string;
  typeIndex: number;
  instance: number;
  typeCount: number;
  typeId: string;
  node: TopologyNode;
  asset: AssetDefinition | null;
  trackers: number;
  stringBoxes: number;
  switchingBoxes: number;
  modules: number;
}

/** One spec per conceptual child instance hanging off the inverter. */
export function inverterSubBlockSpecs(
  tree: TopologyNode | null,
  catalog: AssetDefinition[],
): InverterSubBlockSpec[] {
  if (!tree) return [];
  const inv = firstOfKind(tree, catalog, "inverter");
  const parent = inv?.node ?? tree;
  const byId = catalogMap(catalog);
  const specs: InverterSubBlockSpec[] = [];
  parent.children.forEach((child, typeIndex) => {
    const qty = Math.max(1, child.quantity_per_parent);
    const asset = byId.get(child.asset_id) ?? null;
    for (let i = 0; i < qty; i++) {
      specs.push({
        typeId: child.id,
        id: `sub-${child.id}-${i}`,
        typeIndex,
        instance: i,
        typeCount: qty,
        node: child,
        asset,
        trackers: countKindUnder(child, catalog, "tracker"),
        stringBoxes: countKindUnder(child, catalog, "string_box"),
        switchingBoxes: countKindUnder(child, catalog, "switching_box"),
        modules: countKindUnder(child, catalog, "module"),
      });
    }
  });
  return specs;
}

export function setRootQuantity(forest: TopologyNode[], rootId: string, n: number): TopologyNode[] {
  const q = Math.round(n);
  if (q <= 0) return forest.filter((r) => r.id !== rootId);
  return forest.map((r) =>
    r.id === rootId ? { ...r, quantity_per_parent: Math.max(1, q) } : r,
  );
}

export function trackersPerInverter(project: Project, rootId?: string): number {
  const forest = asForest(project.topology);
  const tree = rootId
    ? (forest.find((r) => r.id === rootId) ?? null)
    : (() => {
        const inv = firstOfKind(forest, project.catalog, "inverter");
        return inv ? rootFor(forest, inv.node.id) : forest[0] ?? null;
      })();
  if (!tree) return 0;
  return Math.max(1, countKindUnder(tree, project.catalog, "tracker"));
}

export function setInverterQuantity(
  topology: TopologyInput,
  catalog: AssetDefinition[],
  n: number,
): TopologyNode[] {
  const forest = asForest(topology);
  const inv = firstOfKind(forest, catalog, "inverter");
  if (!inv) return forest;
  const root = rootFor(forest, inv.node.id);
  if (!root) return forest;
  return setRootQuantity(forest, root.id, n);
}

export function analyzePlant(project: Project): PlantRollup {
  const { counts, cables } = walkTopology(project.topology);
  const byId = catalogMap(project.catalog);

  const countKind = (kind: AssetKind) =>
    [...counts.entries()].reduce((sum, [id, n]) => {
      return byId.get(id)?.kind === kind ? sum + n : sum;
    }, 0);

  const modules = countKind("module");
  const trackers = countKind("tracker");
  const stringBoxes = countKind("string_box");
  const switchingBoxes = countKind("switching_box");
  const inverters = countKind("inverter");

  let dcW = 0;
  for (const [id, n] of counts) {
    const asset = byId.get(id);
    if (asset?.kind === "module" && asset.pmp_w) dcW += n * asset.pmp_w;
  }
  let acKw = 0;
  for (const [id, n] of counts) {
    const asset = byId.get(id);
    if (asset?.kind === "inverter" && asset.pac_kw) acKw += n * asset.pac_kw;
  }

  const dcMwp = dcW / 1e6;
  const acMw = acKw / 1000;
  const dcAc = acMw > 0 ? dcMwp / acMw : null;

  const bom: BomRow[] = [];
  for (const [id, n] of counts) {
    const asset = byId.get(id);
    if (!asset) {
      bom.push({ assetId: id, name: `(missing ${id})`, kind: "module", count: n });
      continue;
    }
    bom.push({ assetId: id, name: asset.name, kind: asset.kind, count: n });
  }
  for (const [id, n] of cables) {
    const asset = byId.get(id);
    bom.push({
      assetId: id,
      name: asset ? `${asset.name} (interconnect)` : `(missing cable ${id})`,
      kind: asset?.kind ?? "dc_cable_l0",
      count: n,
    });
  }
  bom.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  return {
    modules,
    trackers,
    stringBoxes,
    switchingBoxes,
    inverters,
    dcMwp,
    acMw,
    dcAc,
    bom,
    checks: buildChecks(project, counts),
  };
}

function buildChecks(project: Project, counts: Map<string, number>): CheckItem[] {
  const checks: CheckItem[] = [];
  const byId = catalogMap(project.catalog);
  const forest = asForest(project.topology);

  forest.forEach((root, index) => {
    const label = forest.length > 1 ? `Block ${index + 1}: ` : "";
    const moduleHit = firstOfKind(root, project.catalog, "module");
    const trackerHit = firstOfKind(root, project.catalog, "tracker");
    const inverterHit = firstOfKind(root, project.catalog, "inverter");
    const sbHit = firstOfKind(root, project.catalog, "string_box");
    const swHit = firstOfKind(root, project.catalog, "switching_box");

    const modulesPerString = (() => {
      if (!trackerHit) return moduleHit?.node.quantity_per_parent ?? null;
      const mpt =
        trackerHit.asset.modules_per_tracker ?? trackerHit.node.children[0]?.quantity_per_parent;
      const spt = trackerHit.asset.strings_per_tracker;
      if (mpt && spt) return mpt / spt;
      return mpt ?? null;
    })();

    if (moduleHit && inverterHit && modulesPerString) {
      const voc = moduleHit.asset.voc_v;
      const vmax = inverterHit.asset.max_dc_voltage_v;
      if (voc && vmax) {
        const stringVoc = modulesPerString * voc;
        const coldVoc = stringVoc * 1.15;
        checks.push({
          id: `voc-${root.id}`,
          level: stringVoc <= vmax ? "ok" : "fail",
          title: `${label}String Voc vs inverter Vdc max`,
          detail: `${modulesPerString.toFixed(0)} × ${voc} V = ${stringVoc.toFixed(0)} V  (limit ${vmax} V)`,
        });
        checks.push({
          id: `voc-cold-${root.id}`,
          level: coldVoc <= vmax ? "ok" : "warn",
          title: `${label}Cold Voc (×1.15) vs inverter Vdc max`,
          detail: `${coldVoc.toFixed(0)} V  (limit ${vmax} V) — not a full temperature study`,
        });
      }
    }

    if (moduleHit && trackerHit) {
      const l0Id = trackerHit.node.cable_asset_id;
      const l0 = l0Id ? byId.get(l0Id) : null;
      if (l0?.ampacity_a && moduleHit.asset.isc_a) {
        const isc = moduleHit.asset.isc_a;
        checks.push({
          id: `l0-amp-${root.id}`,
          level: isc <= l0.ampacity_a ? "ok" : "fail",
          title: `${label}String Isc vs DC L0 ampacity`,
          detail: `${isc} A vs ${l0.ampacity_a} A (${l0.name})`,
        });
      }
    }

    if (sbHit && trackerHit) {
      const spt = trackerHit.asset.strings_per_tracker ?? 1;
      const trackersPerSb = trackerHit.node.quantity_per_parent;
      const strings = trackersPerSb * spt;
      const inputs = sbHit.asset.inputs;
      if (inputs) {
        checks.push({
          id: `sb-inputs-${root.id}`,
          level: strings <= inputs ? "ok" : "warn",
          title: `${label}String box inputs vs incoming strings`,
          detail: `${strings} strings into ${inputs} inputs (${sbHit.asset.name})`,
        });
      }
    }

    if (swHit && sbHit) {
      const sbs = sbHit.node.quantity_per_parent;
      const inputs = swHit.asset.inputs;
      if (inputs) {
        checks.push({
          id: `sw-inputs-${root.id}`,
          level: sbs <= inputs ? "ok" : "warn",
          title: `${label}Switching box inputs vs string boxes`,
          detail: `${sbs} string boxes into ${inputs} inputs (${swHit.asset.name})`,
        });
      }
    }
  });

  const placed = layoutCounts(project);
  const trackers = [...counts.entries()].reduce((sum, [id, n]) => {
    return byId.get(id)?.kind === "tracker" ? sum + n : sum;
  }, 0);
  const inverters = [...counts.entries()].reduce((sum, [id, n]) => {
    return byId.get(id)?.kind === "inverter" ? sum + n : sum;
  }, 0);
  checks.push({
    id: "layout-trk",
    level: placed.trackers === trackers ? "ok" : "warn",
    title: "Layout trackers vs hierarchy",
    detail: `${placed.trackers} on the plant drawing vs ${trackers} in Config`,
  });
  checks.push({
    id: "layout-inv",
    level: placed.inverters === inverters ? "ok" : "warn",
    title: "Layout inverters vs hierarchy",
    detail: `${placed.inverters} on PCS pads vs ${inverters} in Config`,
  });

  for (const [id] of counts) {
    if (!byId.has(id)) {
      checks.push({
        id: `missing-${id}`,
        level: "fail",
        title: "Catalog reference missing",
        detail: `Topology points at asset ${id} which is not in the catalog.`,
      });
    }
  }

  if (checks.length === 0) {
    checks.push({
      id: "empty",
      level: "warn",
      title: "No checks to run",
      detail: "Add a hierarchy with modules, trackers, and an inverter to enable electrical checks.",
    });
  }

  return checks;
}

export function layoutCounts(project: Project): { trackers: number; inverters: number } {
  const trackers = project.layout.blocks.reduce(
    (n, b) => n + b.rows * b.trackers_per_row,
    0,
  );
  const inverters = project.layout.stations.reduce((n, s) => n + s.inverter_count, 0);
  return { trackers, inverters };
}
