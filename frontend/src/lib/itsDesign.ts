import { uid } from "./ids";
import type {
  ItsAssetKind,
  ItsAssetSpec,
  ItsAssignments,
  ItsDesign,
  ItsHierarchy,
  ItsHierarchyMove,
  ItsItemKind,
  ItsPlacedItem,
  ItsPvBlock,
  ItsString,
  ItsValidation,
  ItsWarning,
  Project,
} from "../types/project";
import { EMPTY_ITS_SPEC_FIELDS } from "../types/project";

export function itsDesignOf(project: Project | null | undefined): ItsDesign {
  return project?.its_design ?? { blocks: [] };
}

export function findItsBlock(design: ItsDesign, blockId: string | undefined): ItsPvBlock | null {
  if (!blockId) return null;
  return design.blocks.find((b) => b.id === blockId) ?? null;
}

export function itemsOf(block: ItsPvBlock, kind: ItsItemKind): ItsPlacedItem[] {
  return block.items.filter((item) => item.kind === kind);
}

export function firstSpec(block: ItsPvBlock, kind: ItsAssetKind): ItsAssetSpec | undefined {
  return block.catalog.find((spec) => spec.kind === kind);
}

export function specById(block: ItsPvBlock, id: string | null | undefined): ItsAssetSpec | undefined {
  if (!id) return undefined;
  return block.catalog.find((spec) => spec.id === id);
}

export function stringsForTable(item: ItsPlacedItem, tracker?: ItsAssetSpec): number {
  const per = tracker?.strings_per_tracker && tracker.strings_per_tracker > 0 ? tracker.strings_per_tracker : 1;
  return item.rows * item.tables_per_row * per;
}

export function stringIdFor(tableId: string, index: number): string {
  return `${tableId}-s${String(index).padStart(3, "0")}`;
}

export function newItsSpec(kind: ItsAssetKind): ItsAssetSpec {
  return {
    id: uid(kind.slice(0, 3)),
    name: `New ${kind.replace("_", " ")}`,
    kind,
    ...EMPTY_ITS_SPEC_FIELDS,
  };
}

export function newItsItem(kind: ItsItemKind, specId: string | null, name: string): ItsPlacedItem {
  return {
    id: uid(kind === "string_box" ? "sb" : kind === "its" ? "its" : "tbl"),
    name,
    kind,
    spec_id: specId,
    x: kind === "table" ? 48 : kind === "string_box" ? 420 : 600,
    y: kind === "table" ? 48 : 80,
    rows: 4,
    tables_per_row: 8,
    sort_order: 0,
  };
}

export function sortItems<T extends { sort_order?: number; name: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function syncStringsFromTables(block: ItsPvBlock): ItsPvBlock {
  const stringSpec = firstSpec(block, "string");
  const existing = new Map(block.strings.map((s) => [s.id, s]));
  const nextStrings: ItsString[] = [];
  const valid = new Set<string>();

  for (const table of itemsOf(block, "table")) {
    const tracker = specById(block, table.spec_id) ?? firstSpec(block, "tracker");
    const count = stringsForTable(table, tracker);
    for (let index = 1; index <= count; index += 1) {
      const id = stringIdFor(table.id, index);
      valid.add(id);
      const prev = existing.get(id);
      nextStrings.push({
        id,
        name: prev?.name ?? `${table.name} · S${String(index).padStart(2, "0")}`,
        table_id: table.id,
        spec_id: prev?.spec_id ?? stringSpec?.id ?? null,
      });
    }
  }

  for (const string of block.strings) {
    if (valid.has(string.id)) continue;
    if (string.table_id) continue;
    nextStrings.push(string);
    valid.add(string.id);
  }

  const boxIds = new Set(itemsOf(block, "string_box").map((b) => b.id));
  const itsIds = new Set(itemsOf(block, "its").map((b) => b.id));
  const string_to_box: Record<string, string> = {};
  for (const [sid, bid] of Object.entries(block.assignments.string_to_box)) {
    if (valid.has(sid) && boxIds.has(bid)) string_to_box[sid] = bid;
  }
  const box_to_its: Record<string, string> = {};
  for (const [bid, iid] of Object.entries(block.assignments.box_to_its)) {
    if (boxIds.has(bid) && itsIds.has(iid)) box_to_its[bid] = iid;
  }

  return {
    ...block,
    strings: nextStrings,
    assignments: { string_to_box, box_to_its },
  };
}

export const DEFAULT_HIERARCHY: ItsHierarchy = {
  modules_per_string: 28,
  strings_per_table: 2,
  table_count: 32,
  string_box_count: 8,
  its_count: 1,
  auto_assign: true,
  tree_customized: false,
};

export function packGrid(count: number, prefer = 8): { rows: number; tables_per_row: number } {
  if (count <= 0) return { rows: 1, tables_per_row: 1 };
  if (count <= prefer) return { rows: 1, tables_per_row: count };
  for (let tpr = prefer; tpr >= 1; tpr -= 1) {
    if (count % tpr === 0) return { rows: count / tpr, tables_per_row: tpr };
  }
  return { rows: count, tables_per_row: 1 };
}

export function inferHierarchy(block: ItsPvBlock): ItsHierarchy {
  const tables = itemsOf(block, "table");
  const boxes = itemsOf(block, "string_box");
  const skids = itemsOf(block, "its");
  const tracker = firstSpec(block, "tracker");
  const string = firstSpec(block, "string");
  const tableCount = tables.reduce((sum, t) => sum + t.rows * t.tables_per_row, 0);
  const existing = block.hierarchy ?? DEFAULT_HIERARCHY;
  return {
    modules_per_string: string?.modules_in_series && string.modules_in_series > 0 ? string.modules_in_series : existing.modules_per_string,
    strings_per_table:
      tracker?.strings_per_tracker && tracker.strings_per_tracker > 0
        ? tracker.strings_per_tracker
        : existing.strings_per_table,
    table_count: tableCount || existing.table_count,
    string_box_count: boxes.length || existing.string_box_count,
    its_count: skids.length || existing.its_count,
    auto_assign: existing.auto_assign,
    tree_customized: existing.tree_customized ?? false,
  };
}

export function applyHierarchy(block: ItsPvBlock, hierarchy: ItsHierarchy): ItsPvBlock {
  let catalog = block.catalog.map((spec) => {
    if (spec.kind === "string") return { ...spec, modules_in_series: hierarchy.modules_per_string };
    if (spec.kind === "tracker") return { ...spec, strings_per_tracker: hierarchy.strings_per_table };
    return spec;
  });
  const next: ItsPvBlock = { ...block, catalog, hierarchy };
  const tracker = firstSpec(next, "tracker");
  const boxSpec = firstSpec(next, "string_box");
  const itsSpec = firstSpec(next, "its");
  const { rows, tables_per_row } = packGrid(hierarchy.table_count);
  const existingTable = itemsOf(block, "table")[0];
  const tables =
    hierarchy.table_count > 0
      ? [
          {
            id: existingTable?.id ?? "hier-tbl-001",
            name: existingTable?.name ?? "Table field",
            kind: "table" as const,
            spec_id: tracker?.id ?? existingTable?.spec_id ?? null,
            x: existingTable?.x ?? 48,
            y: existingTable?.y ?? 48,
            rows,
            tables_per_row,
            sort_order: existingTable?.sort_order ?? 0,
          },
        ]
      : [];
  const boxes = resizeKind(itemsOf(block, "string_box"), hierarchy.string_box_count, "string_box", "hier-sb", "SB", boxSpec?.id ?? null, 420, 56);
  const skids = resizeKind(itemsOf(block, "its"), hierarchy.its_count, "its", "hier-its", "ITS", itsSpec?.id ?? null, 620, 80, 100, 70);
  let synced = syncStringsFromTables({ ...next, items: [...tables, ...boxes, ...skids] });
  if (hierarchy.auto_assign && synced.strings.length && boxes.length) {
    const string_to_box: Record<string, string> = {};
    synced.strings.forEach((s, i) => {
      string_to_box[s.id] = boxes[i % boxes.length].id;
    });
    const box_to_its: Record<string, string> = {};
    if (skids.length) {
      boxes.forEach((b, i) => {
        box_to_its[b.id] = skids[i % skids.length].id;
      });
    }
    synced = {
      ...synced,
      assignments: { string_to_box, box_to_its },
      hierarchy: { ...hierarchy, tree_customized: false },
    };
  }
  return synced;
}

function resizeKind(
  existing: ItsPlacedItem[],
  count: number,
  kind: ItsItemKind,
  prefix: string,
  label: string,
  specId: string | null,
  baseX: number,
  baseY: number,
  dx = 80,
  dy = 56,
): ItsPlacedItem[] {
  const next: ItsPlacedItem[] = [];
  const kept = sortItems(existing);
  for (let index = 0; index < count; index += 1) {
    const prev = kept[index];
    if (prev) {
      next.push({ ...prev, spec_id: specId ?? prev.spec_id, sort_order: prev.sort_order ?? index });
      continue;
    }
    next.push({
      id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      name: `${label} ${String(index + 1).padStart(2, "0")}`,
      kind,
      spec_id: specId,
      x: baseX + (index % 4) * dx,
      y: baseY + Math.floor(index / 4) * dy,
      rows: 1,
      tables_per_row: 1,
      sort_order: index,
    });
  }
  return next;
}

export function validateItsBlock(block: ItsPvBlock): ItsValidation {
  const boxes = itemsOf(block, "string_box");
  const skids = itemsOf(block, "its");
  const stringIds = new Set(block.strings.map((s) => s.id));
  const boxIds = new Set(boxes.map((b) => b.id));
  const itsIds = new Set(skids.map((s) => s.id));
  const warnings: ItsWarning[] = [];

  for (const [sid, bid] of Object.entries(block.assignments.string_to_box)) {
    if (!stringIds.has(sid)) {
      warnings.push({ code: "unknown_string", level: "warn", message: `Assignment references missing string ${sid}.` });
    }
    if (!boxIds.has(bid)) {
      warnings.push({
        code: "unknown_box",
        level: "fail",
        message: `String ${sid} is assigned to missing string box ${bid}.`,
      });
    }
  }
  for (const [bid, iid] of Object.entries(block.assignments.box_to_its)) {
    if (!boxIds.has(bid)) {
      warnings.push({ code: "unknown_box", level: "warn", message: `Assignment references missing string box ${bid}.` });
    }
    if (!itsIds.has(iid)) {
      warnings.push({
        code: "unknown_its",
        level: "fail",
        message: `String box ${bid} is assigned to missing ITS ${iid}.`,
      });
    }
  }

  const assignedStrings = [...stringIds].filter((id) => block.assignments.string_to_box[id]);
  const orphanStrings = [...stringIds].filter((id) => !block.assignments.string_to_box[id]);
  if (orphanStrings.length) {
    const preview = orphanStrings.slice(0, 6).join(", ");
    const extra = orphanStrings.length > 6 ? ` (+${orphanStrings.length - 6} more)` : "";
    warnings.push({
      code: "orphan_strings",
      level: "warn",
      message: `${orphanStrings.length} string(s) are not assigned to a string box: ${preview}${extra}.`,
    });
  }

  const orphanBoxes = boxes.filter((b) => !block.assignments.box_to_its[b.id]);
  if (orphanBoxes.length) {
    warnings.push({
      code: "orphan_boxes",
      level: "warn",
      message: `${orphanBoxes.length} string box(es) are not assigned to an ITS: ${orphanBoxes.map((b) => b.name).join(", ")}.`,
    });
  }

  const usedByBox = new Map<string, number>();
  for (const [sid, bid] of Object.entries(block.assignments.string_to_box)) {
    if (stringIds.has(sid) && boxIds.has(bid)) {
      usedByBox.set(bid, (usedByBox.get(bid) ?? 0) + 1);
    }
  }
  let overloaded = 0;
  for (const box of boxes) {
    const spec = specById(block, box.spec_id);
    const capacity = spec?.inputs ?? null;
    const used = usedByBox.get(box.id) ?? 0;
    if (capacity != null && used > capacity) {
      overloaded += 1;
      warnings.push({
        code: "box_overload",
        level: "fail",
        message: `${box.name} has ${used} strings on ${capacity} inputs.`,
      });
    }
  }

  if (!skids.length) {
    warnings.push({ code: "no_its", level: "warn", message: "No ITS is placed in this PV block." });
  }
  if (!boxes.length) {
    warnings.push({ code: "no_boxes", level: "warn", message: "No string boxes are placed in this PV block." });
  }
  if (!block.strings.length) {
    warnings.push({
      code: "no_strings",
      level: "info",
      message: "No strings yet. Add tables or generate strings.",
    });
  }

  return {
    block_id: block.id,
    table_count: itemsOf(block, "table").length,
    string_count: block.strings.length,
    string_box_count: boxes.length,
    its_count: skids.length,
    assigned_strings: assignedStrings.length,
    orphan_strings: orphanStrings.length,
    orphan_boxes: orphanBoxes.length,
    overloaded_boxes: overloaded,
    warnings,
  };
}

export function replaceItsBlock(design: ItsDesign, block: ItsPvBlock): ItsDesign {
  const exists = design.blocks.some((b) => b.id === block.id);
  return {
    blocks: exists ? design.blocks.map((b) => (b.id === block.id ? block : b)) : [...design.blocks, block],
  };
}

export function assignStringsToBox(block: ItsPvBlock, stringIds: string[], boxId: string | null): ItsPvBlock {
  const string_to_box = { ...block.assignments.string_to_box };
  for (const id of stringIds) {
    if (boxId) string_to_box[id] = boxId;
    else delete string_to_box[id];
  }
  return { ...block, assignments: { ...block.assignments, string_to_box } };
}

export function assignBoxesToIts(block: ItsPvBlock, boxIds: string[], itsId: string | null): ItsPvBlock {
  const box_to_its = { ...block.assignments.box_to_its };
  for (const id of boxIds) {
    if (itsId) box_to_its[id] = itsId;
    else delete box_to_its[id];
  }
  return { ...block, assignments: { ...block.assignments, box_to_its } };
}

export function emptyAssignments(): ItsAssignments {
  return { string_to_box: {}, box_to_its: {} };
}

export function tableParentBoxId(block: ItsPvBlock, tableId: string): string | null | "split" {
  const boxes = new Set(
    block.strings
      .filter((s) => s.table_id === tableId)
      .map((s) => block.assignments.string_to_box[s.id])
      .filter((id): id is string => Boolean(id)),
  );
  if (boxes.size === 0) return null;
  if (boxes.size === 1) return [...boxes][0];
  return "split";
}

export function validateHierarchyMove(block: ItsPvBlock, move: ItsHierarchyMove): string | null {
  const boxIds = new Set(itemsOf(block, "string_box").map((item) => item.id));
  const itsIds = new Set(itemsOf(block, "its").map((item) => item.id));
  const tableIds = new Set(itemsOf(block, "table").map((item) => item.id));
  const stringIds = new Set(block.strings.map((s) => s.id));

  if (move.node_kind === "its") {
    if (!itsIds.has(move.node_id)) return "That ITS is not in this hierarchy.";
    if (move.parent_kind !== "root" && move.parent_kind !== "unassigned") return "ITS stays at the root of the tree.";
    return null;
  }
  if (move.node_kind === "string_box") {
    if (!boxIds.has(move.node_id)) return "That string box is not in this hierarchy.";
    if (move.parent_kind === "its") {
      if (!move.parent_id || !itsIds.has(move.parent_id)) return "Drop a string box on an ITS.";
      return null;
    }
    if (move.parent_kind === "root" || move.parent_kind === "unassigned") return null;
    return "String boxes belong under an ITS, or in Unassigned.";
  }
  if (move.node_kind === "table") {
    if (!tableIds.has(move.node_id)) return "That table field is not in this hierarchy.";
    if (move.parent_kind === "its") return "Tables feed string boxes, not ITS directly.";
    if (move.parent_kind === "string_box") {
      if (!move.parent_id || !boxIds.has(move.parent_id)) return "Drop a table on a string box.";
      return null;
    }
    if (move.parent_kind === "root" || move.parent_kind === "unassigned") return null;
    return "Tables belong under a string box, or in Unassigned.";
  }
  if (move.node_kind === "string") {
    if (!stringIds.has(move.node_id)) return "That string is not in this hierarchy.";
    if (move.parent_kind === "its") return "Strings feed string boxes, not ITS directly.";
    if (move.parent_kind === "string_box") {
      if (!move.parent_id || !boxIds.has(move.parent_id)) return "Drop a string on a string box.";
      return null;
    }
    if (move.parent_kind === "root" || move.parent_kind === "unassigned") return null;
    return "Strings belong under a string box, or in Unassigned.";
  }
  return "Unknown hierarchy node.";
}

function markTreeCustomized(block: ItsPvBlock): ItsPvBlock {
  const hierarchy = block.hierarchy ?? DEFAULT_HIERARCHY;
  return { ...block, hierarchy: { ...hierarchy, auto_assign: false, tree_customized: true } };
}

function reindexKind(items: ItsPlacedItem[], orderedIds: string[]): ItsPlacedItem[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return items.map((item) => (order.has(item.id) ? { ...item, sort_order: order.get(item.id) ?? 0 } : item));
}

export function moveHierarchyNode(block: ItsPvBlock, move: ItsHierarchyMove): ItsPvBlock {
  const reason = validateHierarchyMove(block, move);
  if (reason) throw new Error(reason);

  if (move.node_kind === "its") {
    const ordered = sortItems(itemsOf(block, "its"))
      .map((item) => item.id)
      .filter((id) => id !== move.node_id);
    const index = Math.max(0, Math.min(move.index ?? 0, ordered.length));
    ordered.splice(index, 0, move.node_id);
    return markTreeCustomized({ ...block, items: reindexKind(block.items, ordered) });
  }

  if (move.node_kind === "string_box") {
    const box_to_its = { ...block.assignments.box_to_its };
    if (move.parent_kind === "its" && move.parent_id) {
      box_to_its[move.node_id] = move.parent_id;
    } else {
      delete box_to_its[move.node_id];
    }
    const working = { ...block, assignments: { ...block.assignments, box_to_its } };
    const siblings = sortItems(itemsOf(working, "string_box"))
      .filter((item) => {
        const parent = box_to_its[item.id];
        if (move.parent_kind === "its") return parent === move.parent_id && item.id !== move.node_id;
        return !parent && item.id !== move.node_id;
      })
      .map((item) => item.id);
    const index = Math.max(0, Math.min(move.index ?? siblings.length, siblings.length));
    siblings.splice(index, 0, move.node_id);
    return markTreeCustomized({ ...working, items: reindexKind(working.items, siblings) });
  }

  if (move.node_kind === "table") {
    const stringIds = block.strings.filter((s) => s.table_id === move.node_id).map((s) => s.id);
    const string_to_box = { ...block.assignments.string_to_box };
    if (move.parent_kind === "string_box" && move.parent_id) {
      for (const id of stringIds) string_to_box[id] = move.parent_id;
    } else {
      for (const id of stringIds) delete string_to_box[id];
    }
    const tables = sortItems(itemsOf(block, "table"))
      .map((item) => item.id)
      .filter((id) => id !== move.node_id);
    const index = Math.max(0, Math.min(move.index ?? tables.length, tables.length));
    tables.splice(index, 0, move.node_id);
    return markTreeCustomized({
      ...block,
      items: reindexKind(block.items, tables),
      assignments: { ...block.assignments, string_to_box },
    });
  }

  const string_to_box = { ...block.assignments.string_to_box };
  if (move.parent_kind === "string_box" && move.parent_id) {
    string_to_box[move.node_id] = move.parent_id;
  } else {
    delete string_to_box[move.node_id];
  }
  const ordered = block.strings.map((s) => s.id).filter((id) => id !== move.node_id);
  const index = Math.max(0, Math.min(move.index ?? ordered.length, ordered.length));
  ordered.splice(index, 0, move.node_id);
  const order = new Map(ordered.map((id, i) => [id, i]));
  return markTreeCustomized({
    ...block,
    strings: block.strings.map((s) => ({ ...s, sort_order: order.get(s.id) ?? s.sort_order ?? 0 })),
    assignments: { ...block.assignments, string_to_box },
  });
}
