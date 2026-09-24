import { useState, type DragEvent, type ReactNode } from "react";
import { Card } from "./ui";
import { ITS_KIND_COLOR } from "../lib/itsKinds";
import {
  HIERARCHY_TYPE_LABEL,
  isDefaultTypeOrder,
  levelsOf,
  moveHierarchyNode,
  validateHierarchyMove,
} from "../lib/itsDesign";
import type { ItsHierarchyLevel, ItsHierarchyMove, ItsHierarchyType, ItsPvBlock } from "../types/project";

const TYPE_COLOR: Record<ItsHierarchyType, string> = {
  its: ITS_KIND_COLOR.its,
  string_box: ITS_KIND_COLOR.string_box,
  table: ITS_KIND_COLOR.table,
  string: ITS_KIND_COLOR.string,
  module: ITS_KIND_COLOR.module,
};

function childrenOf(levels: ItsHierarchyLevel[], parent: ItsHierarchyType | null): ItsHierarchyLevel[] {
  return levels
    .filter((level) => level.parent_kind === parent)
    .sort((a, b) => a.order - b.order || a.kind.localeCompare(b.kind));
}

function resolveMove(
  block: ItsPvBlock,
  drag: ItsHierarchyType,
  target: ItsHierarchyType | "root",
): ItsHierarchyMove | { reason: string } {
  const move: ItsHierarchyMove =
    target === "root"
      ? { kind: drag, parent_kind: null }
      : { kind: drag, parent_kind: target };
  const reason = validateHierarchyMove(block, move);
  return reason ? { reason } : move;
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
  const levels = levelsOf(block);
  const roots = childrenOf(levels, null);
  const [drag, setDrag] = useState<ItsHierarchyType | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const applyResolved = (target: ItsHierarchyType | "root") => {
    if (!drag) return;
    const resolved = resolveMove(block, drag, target);
    if (!isMove(resolved)) {
      setReason(resolved.reason);
      return;
    }
    try {
      onMove(moveHierarchyNode(block, resolved));
      setReason(null);
    } catch (err) {
      setReason(err instanceof Error ? err.message : "Could not move that type.");
    }
  };

  const dropProps = (target: ItsHierarchyType | "root") => {
    const key = target;
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
      onDragLeave: () => setOver((current) => (current === key ? null : current)),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        applyResolved(target);
        setOver(null);
        setDrag(null);
      },
    };
  };

  const highlight = (target: ItsHierarchyType | "root") => {
    if (over !== target || !drag) return "";
    return isMove(resolveMove(block, drag, target))
      ? "outline outline-2 outline-accent bg-accent-dim/40"
      : "outline outline-2 outline-danger/50";
  };

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted">
        Drag a type block to change conceptual nesting. This is not a list of plant instances — counts
        live on Quantities.
      </p>
      {!isDefaultTypeOrder(levels) ? (
        <p className="text-[12px] text-accent">
          Type order differs from the default stack. Grouping still assigns strings → boxes → ITS;
          existing instances are not moved by this change.
        </p>
      ) : null}
      {reason ? <p className="text-[12px] text-warn">{reason}</p> : null}
      <div
        className={`space-y-1 rounded-md border border-line p-2 ${highlight("root")}`}
        {...dropProps("root")}
      >
        {roots.map((level) => (
          <TypeRow
            key={level.kind}
            level={level}
            levels={levels}
            depth={0}
            drag={drag}
            setDrag={setDrag}
            dropProps={dropProps}
            highlight={highlight}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
          />
        ))}
        {roots.length === 0 ? <p className="px-2 py-3 text-[12px] text-muted">No type blocks.</p> : null}
      </div>
      <Card className="p-3 text-[11px] text-muted">
        Drop a type on another type to nest it. Drop on the empty canvas (this card’s border) to make
        it a root. Cycles are rejected.
      </Card>
    </div>
  );
}

function TypeRow({
  level,
  levels,
  depth,
  drag,
  setDrag,
  dropProps,
  highlight,
  onDragEnd,
}: {
  level: ItsHierarchyLevel;
  levels: ItsHierarchyLevel[];
  depth: number;
  drag: ItsHierarchyType | null;
  setDrag: (kind: ItsHierarchyType | null) => void;
  dropProps: (target: ItsHierarchyType | "root") => {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
  };
  highlight: (target: ItsHierarchyType | "root") => string;
  onDragEnd: () => void;
}) {
  const kids = childrenOf(levels, level.kind);
  const dragging = drag === level.kind;
  return (
    <div className={`rounded-md ${highlight(level.kind)} ${dragging ? "opacity-60" : ""}`} {...dropProps(level.kind)}>
      <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: 8 + depth * 14 }}>
        <button
          type="button"
          draggable
          aria-label={`Drag ${HIERARCHY_TYPE_LABEL[level.kind]}`}
          title="Drag to move this type"
          onDragStart={(event) => {
            setDrag(level.kind);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", level.kind);
          }}
          onDragEnd={onDragEnd}
          className="cursor-grab px-1 text-[13px] text-muted active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[level.kind] }} />
        <div className="min-w-0">
          <div className="text-[13px]">{HIERARCHY_TYPE_LABEL[level.kind]}</div>
          <div className="text-[11px] text-muted">Asset type</div>
        </div>
      </div>
      {kids.map((child) => (
        <TypeRow
          key={child.kind}
          level={child}
          levels={levels}
          depth={depth + 1}
          drag={drag}
          setDrag={setDrag}
          dropProps={dropProps}
          highlight={highlight}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}

export function TypeHierarchyPreview({ block }: { block: ItsPvBlock }) {
  const levels = levelsOf(block);
  const render = (parent: ItsHierarchyType | null, depth: number): ReactNode =>
    childrenOf(levels, parent).map((level) => (
      <div key={level.kind}>
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 12 }}>
          <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[level.kind] }} />
          <span className="text-[13px]">{HIERARCHY_TYPE_LABEL[level.kind]}</span>
        </div>
        {render(level.kind, depth + 1)}
      </div>
    ));
  return <Card className="p-3">{render(null, 0)}</Card>;
}
