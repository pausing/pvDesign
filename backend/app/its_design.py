from __future__ import annotations

from collections import defaultdict
from typing import Optional

from app.models import (
    ItsAssetSpec,
    ItsAssignments,
    ItsDesign,
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

    # Keep any manually added strings that are not table-generated
    for string in block.strings:
        if string.id in valid_ids:
            continue
        if string.table_id and any(t.id == string.table_id for t in items_of(block, "table")):
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
    return block.model_copy(update={"assignments": ItsAssignments(string_to_box=string_to_box, box_to_its=box_to_its)})


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
