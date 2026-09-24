from __future__ import annotations

from collections import defaultdict
from typing import Optional

from app.models import (
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
    LayoutView,
)


def _spec_map(block: ItsPvBlock) -> dict[str, ItsAssetSpec]:
    return {spec.id: spec for spec in block.catalog}


def first_spec(block: ItsPvBlock, kind: str) -> Optional[ItsAssetSpec]:
    return next((spec for spec in block.catalog if spec.kind == kind), None)


def items_of(block: ItsPvBlock, kind: ItsItemKind) -> list[ItsPlacedItem]:
    return [item for item in block.items if item.kind == kind]


def strings_for_table(item: ItsPlacedItem, tracker: Optional[ItsAssetSpec]) -> int:
    per_tracker = 1
    if tracker and tracker.strings_per_tracker and tracker.strings_per_tracker > 0:
        per_tracker = tracker.strings_per_tracker
    return item.rows * item.tables_per_row * per_tracker


def string_id_for(table_id: str, index: int) -> str:
    return f"{table_id}-s{index:03d}"


def sync_strings_from_tables(block: ItsPvBlock) -> ItsPvBlock:
    """Rebuild string instances from table geometry. IDs are stable per table index."""
    specs = _spec_map(block)
    string_spec = first_spec(block, "string")
    existing = {s.id: s for s in block.strings}
    next_strings: list[ItsString] = []
    valid_ids: set[str] = set()

    for table in items_of(block, "table"):
        tracker = specs.get(table.spec_id or "") if table.spec_id else first_spec(block, "tracker")
        count = strings_for_table(table, tracker)
        for index in range(1, count + 1):
            sid = string_id_for(table.id, index)
            valid_ids.add(sid)
            prev = existing.get(sid)
            next_strings.append(
                ItsString(
                    id=sid,
                    name=prev.name if prev else f"{table.name} · S{index:02d}",
                    table_id=table.id,
                    spec_id=prev.spec_id if prev and prev.spec_id else (string_spec.id if string_spec else None),
                )
            )

    # Keep only loose (non-table) strings. Drop strings from removed tables.
    for string in block.strings:
        if string.id in valid_ids:
            continue
        if string.table_id:
            continue
        next_strings.append(string)
        valid_ids.add(string.id)

    box_ids = {item.id for item in items_of(block, "string_box")}
    its_ids = {item.id for item in items_of(block, "its")}
    string_to_box = {
        sid: bid
        for sid, bid in block.assignments.string_to_box.items()
        if sid in valid_ids and bid in box_ids
    }
    box_to_its = {
        bid: iid
        for bid, iid in block.assignments.box_to_its.items()
        if bid in box_ids and iid in its_ids
    }
    return block.model_copy(
        update={
            "strings": next_strings,
            "assignments": ItsAssignments(string_to_box=string_to_box, box_to_its=box_to_its),
        }
    )


def pack_grid(count: int, prefer: int = 8) -> tuple[int, int]:
    if count <= 0:
        return 1, 1
    if count <= prefer:
        return 1, count
    for tpr in range(prefer, 0, -1):
        if count % tpr == 0:
            return count // tpr, tpr
    return count, 1


def infer_hierarchy(block: ItsPvBlock) -> ItsHierarchy:
    tables = items_of(block, "table")
    boxes = items_of(block, "string_box")
    skids = items_of(block, "its")
    tracker = first_spec(block, "tracker")
    string = first_spec(block, "string")
    table_count = sum(table.rows * table.tables_per_row for table in tables)
    strings_per = 1
    if tracker and tracker.strings_per_tracker and tracker.strings_per_tracker > 0:
        strings_per = tracker.strings_per_tracker
    modules = 28
    if string and string.modules_in_series and string.modules_in_series > 0:
        modules = string.modules_in_series
    existing = block.hierarchy
    return ItsHierarchy(
        modules_per_string=modules,
        strings_per_table=strings_per,
        table_count=table_count or existing.table_count,
        string_box_count=len(boxes) or existing.string_box_count,
        its_count=len(skids) or existing.its_count,
        auto_assign=existing.auto_assign,
        tree_customized=existing.tree_customized,
    )


def _resize_items(
    existing: list[ItsPlacedItem],
    kind: ItsItemKind,
    count: int,
    spec_id: Optional[str],
    prefix: str,
    label: str,
    base_x: float,
    base_y: float,
    dx: float = 80,
    dy: float = 56,
) -> list[ItsPlacedItem]:
    kept = sorted(
        [item for item in existing if item.kind == kind],
        key=lambda item: (item.sort_order, item.name, item.id),
    )
    next_items: list[ItsPlacedItem] = []
    for index in range(count):
        if index < len(kept):
            item = kept[index]
            next_items.append(
                item.model_copy(update={"spec_id": spec_id or item.spec_id, "sort_order": item.sort_order or index})
            )
            continue
        col = index % 4
        row = index // 4
        next_items.append(
            ItsPlacedItem(
                id=f"{prefix}-{index + 1:03d}",
                name=f"{label} {index + 1:02d}",
                kind=kind,
                spec_id=spec_id,
                x=base_x + col * dx,
                y=base_y + row * dy,
                sort_order=index,
            )
        )
    return next_items


def apply_hierarchy(block: ItsPvBlock, hierarchy: Optional[ItsHierarchy] = None) -> ItsPvBlock:
    """Build tables / boxes / ITS / strings from hierarchy counts. Specs stay in the catalog."""
    hier = hierarchy or block.hierarchy
    catalog = list(block.catalog)
    string_spec = first_spec(block, "string")
    tracker_spec = first_spec(block, "tracker")
    box_spec = first_spec(block, "string_box")
    its_spec = first_spec(block, "its")

    if string_spec:
        catalog = [
            spec.model_copy(update={"modules_in_series": hier.modules_per_string})
            if spec.id == string_spec.id
            else spec
            for spec in catalog
        ]
    if tracker_spec:
        catalog = [
            spec.model_copy(update={"strings_per_tracker": hier.strings_per_table})
            if spec.id == tracker_spec.id
            else spec
            for spec in catalog
        ]

    working = block.model_copy(update={"catalog": catalog, "hierarchy": hier})
    string_spec = first_spec(working, "string")
    tracker_spec = first_spec(working, "tracker")
    box_spec = first_spec(working, "string_box")
    its_spec = first_spec(working, "its")

    rows, tpr = pack_grid(max(hier.table_count, 0))
    tables: list[ItsPlacedItem] = []
    if hier.table_count > 0:
        existing_tables = items_of(block, "table")
        first = existing_tables[0] if existing_tables else None
        tables = [
            ItsPlacedItem(
                id=first.id if first else "hier-tbl-001",
                name=first.name if first else "Table field",
                kind="table",
                spec_id=tracker_spec.id if tracker_spec else (first.spec_id if first else None),
                x=first.x if first else 48,
                y=first.y if first else 48,
                rows=rows,
                tables_per_row=tpr,
                sort_order=first.sort_order if first else 0,
            )
        ]

    boxes = _resize_items(
        items_of(block, "string_box"),
        "string_box",
        hier.string_box_count,
        box_spec.id if box_spec else None,
        "hier-sb",
        "SB",
        420,
        56,
    )
    skids = _resize_items(
        items_of(block, "its"),
        "its",
        hier.its_count,
        its_spec.id if its_spec else None,
        "hier-its",
        "ITS",
        620,
        80,
        dx=100,
        dy=70,
    )

    next_block = sync_strings_from_tables(
        working.model_copy(update={"items": [*tables, *boxes, *skids]})
    )
    if hier.auto_assign and next_block.strings and boxes:
        string_to_box = {
            string.id: boxes[index % len(boxes)].id for index, string in enumerate(next_block.strings)
        }
        box_to_its = {}
        if skids:
            box_to_its = {box.id: skids[index % len(skids)].id for index, box in enumerate(boxes)}
        next_block = next_block.model_copy(
            update={"assignments": ItsAssignments(string_to_box=string_to_box, box_to_its=box_to_its)}
        )
        hier = hier.model_copy(update={"tree_customized": False})
        next_block = next_block.model_copy(update={"hierarchy": hier})
    return next_block


class HierarchyMoveError(ValueError):
    """Invalid hierarchy drag: message is safe to show in the UI."""


def _sorted_items(items: list[ItsPlacedItem]) -> list[ItsPlacedItem]:
    return sorted(items, key=lambda item: (item.sort_order, item.name, item.id))


def _reindex_kind(items: list[ItsPlacedItem], kind: ItsItemKind, ordered_ids: list[str]) -> list[ItsPlacedItem]:
    order = {item_id: index for index, item_id in enumerate(ordered_ids)}
    next_items: list[ItsPlacedItem] = []
    for item in items:
        if item.id in order:
            next_items.append(item.model_copy(update={"sort_order": order[item.id]}))
        elif item.kind == kind:
            next_items.append(item)
        else:
            next_items.append(item)
    return next_items


def _mark_tree_customized(block: ItsPvBlock) -> ItsPvBlock:
    hier = block.hierarchy.model_copy(update={"auto_assign": False, "tree_customized": True})
    return block.model_copy(update={"hierarchy": hier})


def _table_string_ids(block: ItsPvBlock, table_id: str) -> list[str]:
    return [string.id for string in block.strings if string.table_id == table_id]


def validate_hierarchy_move(block: ItsPvBlock, move: ItsHierarchyMove) -> Optional[str]:
    """Return a short rejection reason, or None if the move is allowed."""
    boxes = {item.id: item for item in items_of(block, "string_box")}
    skids = {item.id: item for item in items_of(block, "its")}
    tables = {item.id: item for item in items_of(block, "table")}
    strings = {string.id: string for string in block.strings}

    if move.node_kind == "its":
        if move.node_id not in skids:
            return "That ITS is not in this hierarchy."
        if move.parent_kind not in ("root", "unassigned"):
            return "ITS stays at the root of the tree."
        return None

    if move.node_kind == "string_box":
        if move.node_id not in boxes:
            return "That string box is not in this hierarchy."
        if move.parent_kind == "its":
            if not move.parent_id or move.parent_id not in skids:
                return "Drop a string box on an ITS."
            return None
        if move.parent_kind in ("root", "unassigned"):
            return None
        return "String boxes belong under an ITS, or in Unassigned."

    if move.node_kind == "table":
        if move.node_id not in tables:
            return "That table field is not in this hierarchy."
        if move.parent_kind == "its":
            return "Tables feed string boxes, not ITS directly."
        if move.parent_kind == "string_box":
            if not move.parent_id or move.parent_id not in boxes:
                return "Drop a table on a string box."
            return None
        if move.parent_kind in ("root", "unassigned"):
            return None
        return "Tables belong under a string box, or in Unassigned."

    if move.node_kind == "string":
        if move.node_id not in strings:
            return "That string is not in this hierarchy."
        if move.parent_kind == "its":
            return "Strings feed string boxes, not ITS directly."
        if move.parent_kind == "table":
            return "String parentage follows the table field; assign the table instead."
        if move.parent_kind == "string_box":
            if not move.parent_id or move.parent_id not in boxes:
                return "Drop a string on a string box."
            return None
        if move.parent_kind in ("root", "unassigned"):
            return None
        return "Strings belong under a string box, or in Unassigned."

    return "Unknown hierarchy node."


def move_hierarchy_node(block: ItsPvBlock, move: ItsHierarchyMove) -> ItsPvBlock:
    """Reparent / reorder an instance block. Updates assignments so grouping stays in sync."""
    reason = validate_hierarchy_move(block, move)
    if reason:
        raise HierarchyMoveError(reason)

    items = list(block.items)
    assignments = block.assignments
    strings = list(block.strings)

    if move.node_kind == "its":
        skids = _sorted_items(items_of(block, "its"))
        ordered = [item.id for item in skids if item.id != move.node_id]
        index = 0 if move.index is None else max(0, min(move.index, len(ordered)))
        ordered.insert(index, move.node_id)
        return _mark_tree_customized(block.model_copy(update={"items": _reindex_kind(items, "its", ordered)}))

    if move.node_kind == "string_box":
        box_to_its = dict(assignments.box_to_its)
        if move.parent_kind == "its" and move.parent_id:
            box_to_its[move.node_id] = move.parent_id
            siblings = [
                item.id
                for item in _sorted_items(items_of(block, "string_box"))
                if box_to_its.get(item.id) == move.parent_id and item.id != move.node_id
            ]
        else:
            box_to_its.pop(move.node_id, None)
            siblings = [
                item.id
                for item in _sorted_items(items_of(block, "string_box"))
                if item.id not in box_to_its and item.id != move.node_id
            ]
        index = 0 if move.index is None else max(0, min(move.index, len(siblings)))
        siblings.insert(index, move.node_id)
        next_items = _reindex_kind(items, "string_box", siblings)
        return _mark_tree_customized(
            block.model_copy(
                update={
                    "items": next_items,
                    "assignments": assignments.model_copy(update={"box_to_its": box_to_its}),
                }
            )
        )

    if move.node_kind == "table":
        string_ids = _table_string_ids(block, move.node_id)
        string_to_box = dict(assignments.string_to_box)
        if move.parent_kind == "string_box" and move.parent_id:
            for sid in string_ids:
                string_to_box[sid] = move.parent_id
        else:
            for sid in string_ids:
                string_to_box.pop(sid, None)
        tables = [item.id for item in _sorted_items(items_of(block, "table")) if item.id != move.node_id]
        index = 0 if move.index is None else max(0, min(move.index, len(tables)))
        tables.insert(index, move.node_id)
        return _mark_tree_customized(
            block.model_copy(
                update={
                    "items": _reindex_kind(items, "table", tables),
                    "assignments": assignments.model_copy(update={"string_to_box": string_to_box}),
                }
            )
        )

    if move.node_kind == "string":
        string_to_box = dict(assignments.string_to_box)
        if move.parent_kind == "string_box" and move.parent_id:
            string_to_box[move.node_id] = move.parent_id
        else:
            string_to_box.pop(move.node_id, None)
        ordered = [string.id for string in strings if string.id != move.node_id]
        index = 0 if move.index is None else max(0, min(move.index, len(ordered)))
        ordered.insert(index, move.node_id)
        order = {sid: i for i, sid in enumerate(ordered)}
        next_strings = [
            string.model_copy(update={"sort_order": order.get(string.id, string.sort_order)})
            for string in strings
        ]
        return _mark_tree_customized(
            block.model_copy(
                update={
                    "strings": next_strings,
                    "assignments": assignments.model_copy(update={"string_to_box": string_to_box}),
                }
            )
        )

    raise HierarchyMoveError("Unknown hierarchy node.")


def validate_block(block: ItsPvBlock) -> ItsValidation:
    specs = _spec_map(block)
    tables = items_of(block, "table")
    boxes = items_of(block, "string_box")
    skids = items_of(block, "its")
    string_ids = {s.id for s in block.strings}
    box_ids = {b.id for b in boxes}
    its_ids = {s.id for s in skids}
    warnings: list[ItsWarning] = []

    for sid, bid in block.assignments.string_to_box.items():
        if sid not in string_ids:
            warnings.append(
                ItsWarning(code="unknown_string", level="warn", message=f"Assignment references missing string {sid}.")
            )
        if bid not in box_ids:
            warnings.append(
                ItsWarning(
                    code="unknown_box",
                    level="fail",
                    message=f"String {sid} is assigned to missing string box {bid}.",
                )
            )

    for bid, iid in block.assignments.box_to_its.items():
        if bid not in box_ids:
            warnings.append(
                ItsWarning(code="unknown_box", level="warn", message=f"Assignment references missing string box {bid}.")
            )
        if iid not in its_ids:
            warnings.append(
                ItsWarning(
                    code="unknown_its",
                    level="fail",
                    message=f"String box {bid} is assigned to missing ITS {iid}.",
                )
            )

    assigned_string_ids = {sid for sid in block.assignments.string_to_box if sid in string_ids}
    orphan_strings = sorted(string_ids - assigned_string_ids)
    if orphan_strings:
        preview = ", ".join(orphan_strings[:6])
        extra = f" (+{len(orphan_strings) - 6} more)" if len(orphan_strings) > 6 else ""
        warnings.append(
            ItsWarning(
                code="orphan_strings",
                level="warn",
                message=f"{len(orphan_strings)} string(s) are not assigned to a string box: {preview}{extra}.",
            )
        )

    assigned_box_ids = {bid for bid in block.assignments.box_to_its if bid in box_ids}
    orphan_boxes = sorted(box_ids - assigned_box_ids)
    if orphan_boxes:
        names = ", ".join(next(b.name for b in boxes if b.id == bid) for bid in orphan_boxes)
        warnings.append(
            ItsWarning(
                code="orphan_boxes",
                level="warn",
                message=f"{len(orphan_boxes)} string box(es) are not assigned to an ITS: {names}.",
            )
        )

    by_box: dict[str, list[str]] = defaultdict(list)
    for sid, bid in block.assignments.string_to_box.items():
        if sid in string_ids and bid in box_ids:
            by_box[bid].append(sid)

    overloaded = 0
    for box in boxes:
        spec = specs.get(box.spec_id or "")
        capacity = spec.inputs if spec and spec.inputs else None
        used = len(by_box.get(box.id, []))
        if capacity is not None and used > capacity:
            overloaded += 1
            warnings.append(
                ItsWarning(
                    code="box_overload",
                    level="fail",
                    message=f"{box.name} has {used} strings on {capacity} inputs.",
                )
            )

    if not skids:
        warnings.append(
            ItsWarning(code="no_its", level="warn", message="No ITS is placed in this PV block.")
        )
    if not boxes:
        warnings.append(
            ItsWarning(code="no_boxes", level="warn", message="No string boxes are placed in this PV block.")
        )
    if not block.strings:
        warnings.append(
            ItsWarning(code="no_strings", level="info", message="No strings yet. Add tables or generate strings.")
        )

    return ItsValidation(
        block_id=block.id,
        table_count=len(tables),
        string_count=len(block.strings),
        string_box_count=len(boxes),
        its_count=len(skids),
        assigned_strings=len(assigned_string_ids),
        orphan_strings=len(orphan_strings),
        orphan_boxes=len(orphan_boxes),
        overloaded_boxes=overloaded,
        warnings=warnings,
    )


def default_catalog() -> list[ItsAssetSpec]:
    return [
        ItsAssetSpec(
            id="its-mod-580",
            name="580 W bifacial module",
            kind="module",
            manufacturer="Generic",
            model="G-580-BIF",
            pmp_w=580,
            voc_v=51.5,
            isc_a=14.2,
            vmp_v=43.2,
            imp_a=13.43,
            length_mm=2278,
            width_mm=1134,
            bifacial=True,
        ),
        ItsAssetSpec(
            id="its-str-28",
            name="String · 28 modules",
            kind="string",
            modules_in_series=28,
            polarity_notes="+ / − homopolar; keep polarity consistent at the string box.",
            module_spec_id="its-mod-580",
        ),
        ItsAssetSpec(
            id="its-trk-1p-56",
            name="1P tracker · 56 modules",
            kind="tracker",
            manufacturer="Generic",
            model="T-1P-56",
            modules_per_tracker=56,
            strings_per_tracker=2,
            table_length_m=64,
            table_width_m=2.4,
        ),
        ItsAssetSpec(
            id="its-sb-16",
            name="String box 16-in",
            kind="string_box",
            manufacturer="Generic",
            model="SB-16",
            inputs=16,
            fuse_rating_a=16,
            outgoing_cable="DC L1 240 mm² Al",
            max_current_a=400,
            max_voltage_v=1500,
        ),
        ItsAssetSpec(
            id="its-skid-2x3125",
            name="ITS 2 × 3.125 MW",
            kind="its",
            manufacturer="Generic",
            model="ITS-6.3",
            inverter_count=2,
            inverter_rating_kw=3125,
            transformer_mva=6.3,
            transformer_mv_kv=33,
            auxiliaries="LV aux board, HVAC, fire detection, SCADA I/O",
        ),
    ]


def default_block(name: str = "PV block 1", notes: str = "") -> ItsPvBlock:
    catalog = default_catalog()
    tables = [
        ItsPlacedItem(
            id="tbl-a",
            name="Table field A",
            kind="table",
            spec_id="its-trk-1p-56",
            x=48,
            y=48,
            rows=4,
            tables_per_row=8,
        ),
        ItsPlacedItem(
            id="tbl-b",
            name="Table field B",
            kind="table",
            spec_id="its-trk-1p-56",
            x=48,
            y=220,
            rows=4,
            tables_per_row=8,
        ),
    ]
    boxes = [
        ItsPlacedItem(id="sb-1", name="SB-01", kind="string_box", spec_id="its-sb-16", x=420, y=56),
        ItsPlacedItem(id="sb-2", name="SB-02", kind="string_box", spec_id="its-sb-16", x=420, y=120),
        ItsPlacedItem(id="sb-3", name="SB-03", kind="string_box", spec_id="its-sb-16", x=420, y=184),
        ItsPlacedItem(id="sb-4", name="SB-04", kind="string_box", spec_id="its-sb-16", x=420, y=248),
        ItsPlacedItem(id="sb-5", name="SB-05", kind="string_box", spec_id="its-sb-16", x=500, y=56),
        ItsPlacedItem(id="sb-6", name="SB-06", kind="string_box", spec_id="its-sb-16", x=500, y=120),
        ItsPlacedItem(id="sb-7", name="SB-07", kind="string_box", spec_id="its-sb-16", x=500, y=184),
        ItsPlacedItem(id="sb-8", name="SB-08", kind="string_box", spec_id="its-sb-16", x=500, y=248),
    ]
    skid = ItsPlacedItem(
        id="its-1",
        name="ITS-01",
        kind="its",
        spec_id="its-skid-2x3125",
        x=600,
        y=140,
    )
    block = ItsPvBlock(
        id="its-block-1",
        name=name,
        notes=notes or "One PV block: tables → strings → string boxes → ITS.",
        catalog=catalog,
        items=[*tables, *boxes, skid],
        view=LayoutView(),
    )
    block = sync_strings_from_tables(block)
    string_to_box: dict[str, str] = {}
    for index, string in enumerate(block.strings):
        string_to_box[string.id] = boxes[index % len(boxes)].id
    box_to_its = {box.id: skid.id for box in boxes}
    hierarchy = ItsHierarchy(
        modules_per_string=28,
        strings_per_table=2,
        table_count=64,
        string_box_count=8,
        its_count=1,
        auto_assign=True,
    )
    return block.model_copy(
        update={
            "assignments": ItsAssignments(string_to_box=string_to_box, box_to_its=box_to_its),
            "hierarchy": hierarchy,
        }
    )


def empty_block(block_id: str, name: str, notes: str = "") -> ItsPvBlock:
    return ItsPvBlock(id=block_id, name=name, notes=notes, catalog=default_catalog())


def default_its_design() -> ItsDesign:
    return ItsDesign(blocks=[default_block()])


def find_block(design: ItsDesign, block_id: str) -> Optional[ItsPvBlock]:
    return next((block for block in design.blocks if block.id == block_id), None)


def replace_block(design: ItsDesign, block: ItsPvBlock) -> ItsDesign:
    blocks = [block if existing.id == block.id else existing for existing in design.blocks]
    if not any(existing.id == block.id for existing in design.blocks):
        blocks.append(block)
    return ItsDesign(blocks=blocks)
