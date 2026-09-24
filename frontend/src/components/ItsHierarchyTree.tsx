import { useState, type DragEvent, type ReactNode } from "react";
import { Card } from "./ui";
import { ITS_KIND_COLOR } from "../lib/itsKinds";
import {
  itemsOf,
  moveHierarchyNode,
  sortItems,
  tableParentBoxId,
  validateHierarchyMove,
} from "../lib/itsDesign";
import type {
  ItsHierarchyMove,
  ItsHierarchyNodeKind,
  ItsHierarchyParentKind,
  ItsPlacedItem,
  ItsPvBlock,
} from "../types/project";

type DragNode = { id: string; kind: ItsHierarchyNodeKind };

type DropTarget = {
  id: string;
  kind: ItsHierarchyParentKind | ItsHierarchyNodeKind;
};

function resolveMove(block: ItsPvBlock, drag: DragNode, target: DropTarget): ItsHierarchyMove | { reason: string } {
  const draft = (move: ItsHierarchyMove) => {
    const reason = validateHierarchyMove(block, move);
    return reason ? { reason } : move;
  };

  if (target.kind === "unassigned" || target.kind === "root") {
    return draft({
      node_id: drag.id,
      node_kind: drag.kind,
      parent_id: null,
      parent_kind: target.kind === "root" ? "root" : "unassigned",
    });
  }

  if (drag.kind === "its") {
    if (target.kind === "its") {
      const skids = sortItems(itemsOf(block, "its"));
      const index = skids.findIndex((item) => item.id === target.id);
      return draft({
        node_id: drag.id,
        node_kind: "its",
        parent_kind: "root",
        index: index < 0 ? skids.length : index,
      });
    }
    return { reason: "ITS stays at the root of the tree." };
  }

  if (drag.kind === "string_box") {
    if (target.kind === "its") {
      return draft({
        node_id: drag.id,
        node_kind: "string_box",
        parent_id: target.id,
        parent_kind: "its",
      });
    }
    if (target.kind === "string_box") {
      const parentId = block.assignments.box_to_its[target.id] ?? null;
      const siblings = sortItems(itemsOf(block, "string_box")).filter((item) =>
        parentId ? block.assignments.box_to_its[item.id] === parentId : !block.assignments.box_to_its[item.id],
      );
      const index = siblings.findIndex((item) => item.id === target.id);
      if (!parentId) {
        return draft({
          node_id: drag.id,
          node_kind: "string_box",
          parent_kind: "unassigned",
          index: index < 0 ? siblings.length : index,
        });
      }
      return draft({
        node_id: drag.id,
        node_kind: "string_box",
        parent_id: parentId,
        parent_kind: "its",
        index: index < 0 ? siblings.length : index,
      });
    }
    return { reason: "String boxes belong under an ITS, or in Unassigned." };
  }

  if (drag.kind === "table" || drag.kind === "string") {
    if (target.kind === "string_box") {
      return draft({
        node_id: drag.id,
        node_kind: drag.kind,
        parent_id: target.id,
        parent_kind: "string_box",
      });
    }
    if (target.kind === "table" && drag.kind === "table") {
      const parent = tableParentBoxId(block, target.id);
      if (parent === "split" || parent == null) {
        return { reason: "Drop this table on a string box." };
      }
      const siblings = sortItems(itemsOf(block, "table")).filter(
        (item) => tableParentBoxId(block, item.id) === parent,
      );
      const index = siblings.findIndex((item) => item.id === target.id);
      return draft({
        node_id: drag.id,
        node_kind: "table",
        parent_id: parent,
        parent_kind: "string_box",
        index: index < 0 ? siblings.length : index,
      });
    }
    if (target.kind === "its") {
      return { reason: `${drag.kind === "table" ? "Tables" : "Strings"} feed string boxes, not ITS directly.` };
    }
    return { reason: "Drop on a string box, or Unassigned." };
  }

  return { reason: "Unknown hierarchy node." };
}

function isMove(value: ItsHierarchyMove | { reason: string }): value is ItsHierarchyMove {
  return !("reason" in value);
}

export function ItsHierarchyTree({
  block,
  onMove,
}: {
  block: ItsPvBlock;
  onMove: (next: ItsPvBlock) => void;
}) {
  const [drag, setDrag] = useState<DragNode | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const skids = sortItems(itemsOf(block, "its"));
  const boxes = sortItems(itemsOf(block, "string_box"));
  const tables = sortItems(itemsOf(block, "table"));
  const assignedBoxIds = new Set(Object.keys(block.assignments.box_to_its));
  const unassignedBoxes = boxes.filter((box) => !assignedBoxIds.has(box.id));
  const unassignedTables = tables.filter((table) => tableParentBoxId(block, table.id) == null);

  const splitTablesForIts = (itsId: string) =>
    tables.filter((table) => {
      if (tableParentBoxId(block, table.id) !== "split") return false;
      return block.strings.some((string) => {
        if (string.table_id !== table.id) return false;
        const boxId = block.assignments.string_to_box[string.id];
        return Boolean(boxId && block.assignments.box_to_its[boxId] === itsId);
      });
    });

  const applyResolved = (target: DropTarget) => {
    if (!drag) return;
    const resolved = resolveMove(block, drag, target);
    if (!isMove(resolved)) {
      setReason(resolved.reason);
      return;
    }
    if (resolved.node_id === resolved.parent_id) return;
    try {
      onMove(moveHierarchyNode(block, resolved));
      setReason(null);
    } catch (err) {
      setReason(err instanceof Error ? err.message : "Could not move that block.");
    }
  };

  const onDragStart = (node: DragNode) => (event: DragEvent) => {
    setDrag(node);
    setReason(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${node.kind}:${node.id}`);
  };

  const onDragEnd = () => {
    setDrag(null);
    setOver(null);
  };

  const dropProps = (target: DropTarget): {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    "data-over"?: string;
  } => {
    const key = `${target.kind}:${target.id}`;
    const preview = drag ? resolveMove(block, drag, target) : null;
    const valid = preview ? isMove(preview) : false;
    return {
      onDragOver: (event: DragEvent) => {
        if (!drag) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = valid ? "move" : "none";
        setOver(key);
        if (preview && !isMove(preview)) setReason(preview.reason);
        else if (valid) setReason(null);
      },
      onDragLeave: () => {
        setOver((current) => (current === key ? null : current));
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        applyResolved(target);
        setOver(null);
        setDrag(null);
      },
      "data-over": over === key ? (valid ? "ok" : "no") : undefined,
    };
  };

  const highlight = (target: DropTarget) => {
    const key = `${target.kind}:${target.id}`;
    if (over !== key || !drag) return "";
    return isMove(resolveMove(block, drag, target))
      ? "outline outline-2 outline-accent bg-accent-dim/40"
      : "outline outline-2 outline-danger/50";
  };

  if (!skids.length && !boxes.length && !tables.length) {
    return (
      <Card className="p-4 text-[13px] text-muted">
        No instances yet. Set quantities and apply hierarchy to create movable ITS, string box, and
        table blocks.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted">
        Drag the handle to move a block. String boxes go under ITS; tables (and their strings) go
        under string boxes. Invalid drops stay put.
      </p>
      {reason ? <p className="text-[12px] text-warn">{reason}</p> : null}
      <div
        className={`space-y-2 rounded-md border border-line p-2 ${highlight({ id: "root", kind: "root" })}`}
        {...dropProps({ id: "root", kind: "root" })}
      >
        {skids.map((skid) => {
          const childBoxes = boxes.filter((box) => block.assignments.box_to_its[box.id] === skid.id);
          const splitTables = splitTablesForIts(skid.id);
          return (
            <TreeRow
              key={skid.id}
              color={ITS_KIND_COLOR.its}
              label={skid.name}
              detail="ITS"
              kind="its"
              id={skid.id}
              depth={0}
              drag={drag}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dropProps={dropProps}
              highlight={highlight}
            >
              {childBoxes.map((box) => (
                <BoxBranch
                  key={box.id}
                  block={block}
                  box={box}
                  tables={tables}
                  drag={drag}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  dropProps={dropProps}
                  highlight={highlight}
                />
              ))}
              {splitTables.map((table) => (
                <TableRow
                  key={table.id}
                  block={block}
                  table={table}
                  drag={drag}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  dropProps={dropProps}
                  highlight={highlight}
                />
              ))}
              {childBoxes.length === 0 && splitTables.length === 0 ? (
                <p className="pl-8 text-[11px] text-muted">No string boxes under this ITS.</p>
              ) : null}
            </TreeRow>
          );
        })}
      </div>
      <div
        className={`rounded-md border border-dashed border-line p-2 ${highlight({ id: "unassigned", kind: "unassigned" })}`}
        {...dropProps({ id: "unassigned", kind: "unassigned" })}
      >
        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Unassigned</div>
        {unassignedBoxes.map((box) => (
          <BoxBranch
            key={box.id}
            block={block}
            box={box}
            tables={tables}
            drag={drag}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dropProps={dropProps}
            highlight={highlight}
          />
        ))}
        {unassignedTables.map((table) => (
          <TableRow
            key={table.id}
            block={block}
            table={table}
            drag={drag}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dropProps={dropProps}
            highlight={highlight}
          />
        ))}
        {unassignedBoxes.length === 0 && unassignedTables.length === 0 ? (
          <p className="text-[11px] text-muted">Drop a box or table here to unassign it.</p>
        ) : null}
      </div>
    </div>
  );
}

function BoxBranch({
  block,
  box,
  tables,
  drag,
  onDragStart,
  onDragEnd,
  dropProps,
  highlight,
}: {
  block: ItsPvBlock;
  box: ItsPlacedItem;
  tables: ItsPlacedItem[];
  drag: DragNode | null;
  onDragStart: (node: DragNode) => (event: DragEvent) => void;
  onDragEnd: () => void;
  dropProps: (target: DropTarget) => {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    "data-over"?: string;
  };
  highlight: (target: DropTarget) => string;
}) {
  const childTables = tables.filter((table) => tableParentBoxId(block, table.id) === box.id);
  const used = Object.values(block.assignments.string_to_box).filter((id) => id === box.id).length;
  return (
    <TreeRow
      color={ITS_KIND_COLOR.string_box}
      label={box.name}
      detail={`${used} strings`}
      kind="string_box"
      id={box.id}
      depth={1}
      drag={drag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      dropProps={dropProps}
      highlight={highlight}
    >
      {childTables.map((table) => (
        <TableRow
          key={table.id}
          block={block}
          table={table}
          drag={drag}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          dropProps={dropProps}
          highlight={highlight}
        />
      ))}
    </TreeRow>
  );
}

function TableRow({
  block,
  table,
  drag,
  onDragStart,
  onDragEnd,
  dropProps,
  highlight,
}: {
  block: ItsPvBlock;
  table: ItsPlacedItem;
  drag: DragNode | null;
  onDragStart: (node: DragNode) => (event: DragEvent) => void;
  onDragEnd: () => void;
  dropProps: (target: DropTarget) => {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    "data-over"?: string;
  };
  highlight: (target: DropTarget) => string;
}) {
  const count = block.strings.filter((s) => s.table_id === table.id).length;
  const parent = tableParentBoxId(block, table.id);
  const units = table.rows * table.tables_per_row;
  return (
    <TreeRow
      color={ITS_KIND_COLOR.table}
      label={table.name}
      detail={`${units} table(s) · ${count} string(s)${parent === "split" ? " · split across boxes" : ""}`}
      kind="table"
      id={table.id}
      depth={2}
      drag={drag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      dropProps={dropProps}
      highlight={highlight}
    />
  );
}

function TreeRow({
  color,
  label,
  detail,
  kind,
  id,
  depth,
  drag,
  onDragStart,
  onDragEnd,
  dropProps,
  highlight,
  children,
}: {
  color: string;
  label: string;
  detail: string;
  kind: ItsHierarchyNodeKind;
  id: string;
  depth: number;
  drag: DragNode | null;
  onDragStart: (node: DragNode) => (event: DragEvent) => void;
  onDragEnd: () => void;
  dropProps: (target: DropTarget) => {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    "data-over"?: string;
  };
  highlight: (target: DropTarget) => string;
  children?: ReactNode;
}) {
  const target: DropTarget = { id, kind };
  const dragging = drag?.id === id;
  return (
    <div
      className={`rounded-md ${highlight(target)} ${dragging ? "opacity-60" : ""}`}
      {...dropProps(target)}
    >
      <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: 8 + depth * 12 }}>
        <button
          type="button"
          draggable
          aria-label={`Drag ${label}`}
          title="Drag to move"
          onDragStart={onDragStart({ id, kind })}
          onDragEnd={onDragEnd}
          className="cursor-grab px-1 text-[13px] text-muted active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate text-[13px]">{label}</div>
          <div className="text-[11px] text-muted">{detail}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
