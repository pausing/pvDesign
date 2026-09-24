import { uid } from "./ids";
import type {
  ItsAssetKind,
  ItsAssetSpec,
  ItsAssignments,
  ItsDesign,
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
  };
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

  const tableIds = new Set(itemsOf(block, "table").map((t) => t.id));
  for (const string of block.strings) {
    if (valid.has(string.id)) continue;
    if (string.table_id && tableIds.has(string.table_id)) continue;
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
