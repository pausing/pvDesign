from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

AssetKind = Literal[
    "module",
    "tracker",
    "string_box",
    "switching_box",
    "inverter",
    "dc_cable_l0",
    "dc_cable_l1",
    "mv_cable",
]

ASSET_KINDS: tuple[AssetKind, ...] = (
    "module",
    "tracker",
    "string_box",
    "switching_box",
    "inverter",
    "dc_cable_l0",
    "dc_cable_l1",
    "mv_cable",
)


class AssetDefinition(BaseModel):
    id: str
    name: str
    kind: AssetKind
    manufacturer: str = ""
    model: str = ""
    notes: str = ""
    # Module
    pmp_w: Optional[float] = None
    voc_v: Optional[float] = None
    isc_a: Optional[float] = None
    vmp_v: Optional[float] = None
    imp_a: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    bifacial: Optional[bool] = None
    # Tracker
    modules_per_tracker: Optional[int] = None
    strings_per_tracker: Optional[int] = None
    table_length_m: Optional[float] = None
    table_width_m: Optional[float] = None
    # Boxes / electrical gear
    inputs: Optional[int] = None
    outputs: Optional[int] = None
    max_current_a: Optional[float] = None
    max_voltage_v: Optional[float] = None
    # Inverter
    pac_kw: Optional[float] = None
    pdc_kw: Optional[float] = None
    max_dc_voltage_v: Optional[float] = None
    mppt_min_v: Optional[float] = None
    mppt_max_v: Optional[float] = None
    mppt_count: Optional[int] = None
    # Cable
    section_mm2: Optional[float] = None
    voltage_kv: Optional[float] = None
    ampacity_a: Optional[float] = None
    conductor: Optional[str] = None


class TopologyNode(BaseModel):
    id: str
    asset_id: str
    quantity_per_parent: int = Field(ge=1, default=1)
    cable_asset_id: Optional[str] = None
    cable_quantity: Optional[int] = None
    children: List["TopologyNode"] = Field(default_factory=list)


class SubBlockPose(BaseModel):
    id: str
    x: float = 0
    y: float = 0


class InnerAssetPose(BaseModel):
    key: str
    x: float = 0
    y: float = 0


class SubBlockInnerLayout(BaseModel):
    sub_id: str
    poses: List[InnerAssetPose] = Field(default_factory=list)


class SubBlockTypeInnerLayout(BaseModel):
    type_id: str
    poses: List[InnerAssetPose] = Field(default_factory=list)


class TrackerBlock(BaseModel):
    id: str
    name: str
    x: float = 80
    y: float = 80
    rows: int = Field(ge=1, default=8)
    trackers_per_row: int = Field(ge=1, default=16)
    pitch_m: float = 12
    orientation: Literal["NS", "EW"] = "NS"
    rotation_deg: float = 0
    source_id: Optional[str] = None
    subblock_poses: List[SubBlockPose] = Field(default_factory=list)
    subblock_inner: List[SubBlockInnerLayout] = Field(default_factory=list)
    subblock_type_inner: List[SubBlockTypeInnerLayout] = Field(default_factory=list)


class InverterStation(BaseModel):
    id: str
    name: str
    x: float = 400
    y: float = 80
    inverter_count: int = Field(ge=0, default=1)
    role: Optional[Literal["pcs", "mv"]] = None
    source_id: Optional[str] = None


class CableRun(BaseModel):
    id: str
    kind: Literal["dc_l0", "dc_l1", "mv"] = "dc_l1"
    from_id: str
    to_id: str
    from_type: Literal["block", "station", "mv"] = "block"
    to_type: Literal["block", "station", "mv"] = "station"


class LayoutView(BaseModel):
    x: float = 0
    y: float = 0
    zoom: float = 1


class Layout(BaseModel):
    blocks: list[TrackerBlock] = Field(default_factory=list)
    stations: list[InverterStation] = Field(default_factory=list)
    cable_runs: list[CableRun] = Field(default_factory=list)
    view: LayoutView = Field(default_factory=LayoutView)


class ProjectParameters(BaseModel):
    tracker_pitch_m: float = 12
    tracker_ns_gap_m: float = 10
    modules_per_tracker: Optional[int] = None
    strings_per_tracker: Optional[int] = None


MvTopology = Literal["radial", "ring", "open-ring"]


class ElectricalBtRow(BaseModel):
    subpark: str = ""
    its: str = ""
    its_id: str = ""
    inv: str = ""
    inverter_id: str = ""
    module_manufacturer: str = ""
    module_power_w: Optional[float] = None
    trackers: Optional[float] = None
    strings_inv: Optional[float] = None
    strings_its: Optional[float] = None
    n_modules: Optional[float] = None
    pot_dc_kwp_inv: Optional[float] = None
    pot_dc_kwp_its: Optional[float] = None
    pot_ac_kva_inv: Optional[float] = None
    pot_ac_kva_its: Optional[float] = None
    ratio: Optional[float] = None
    scb: Optional[str] = None


class ElectricalBtItsSummary(BaseModel):
    subpark: str = ""
    its: str = ""
    its_id: str = ""
    inverter_count: int = 0
    trackers: Optional[float] = None
    strings: Optional[float] = None
    n_modules: Optional[float] = None
    pot_dc_kwp: Optional[float] = None
    pot_ac_kva: Optional[float] = None
    ratio: Optional[float] = None


class ElectricalBtTotals(BaseModel):
    its_count: int = 0
    inverter_count: int = 0
    trackers: Optional[float] = None
    n_modules: Optional[float] = None
    pot_dc_kwp: Optional[float] = None
    pot_ac_kva: Optional[float] = None


class ElectricalBtConfig(BaseModel):
    source_filename: str = ""
    imported_at: str = ""
    sheet_name: str = "Electrical Configuration"
    trackers_header: str = ""
    modules_per_tracker: int = 87
    strings_per_tracker: int = 3
    rows: list[ElectricalBtRow] = Field(default_factory=list)
    by_its: list[ElectricalBtItsSummary] = Field(default_factory=list)
    totals: ElectricalBtTotals = Field(default_factory=ElectricalBtTotals)
    warnings: list[str] = Field(default_factory=list)


class ElectricalMvRow(BaseModel):
    subpark: str = ""
    its: str = ""
    its_id: str = ""
    feeder_id: str = ""
    destination: str = ""
    voltage_kv: Optional[float] = None
    transformer_kva: Optional[float] = None
    cable_section_mm2: Optional[float] = None
    conductor: str = ""
    length_m: Optional[float] = None
    topology: Optional[MvTopology] = None
    load_kva: Optional[float] = None
    notes: str = ""


class ElectricalMvConfig(BaseModel):
    source_filename: str = ""
    imported_at: str = ""
    sheet_name: str = "MV Configuration"
    rows: list[ElectricalMvRow] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


def _as_topology_list(value: Any) -> Any:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


ItsAssetKind = Literal["module", "string", "string_box", "its", "tracker"]

ITS_ASSET_KINDS: tuple[ItsAssetKind, ...] = (
    "module",
    "string",
    "string_box",
    "its",
    "tracker",
)

ItsItemKind = Literal["table", "string_box", "its"]


class ItsAssetSpec(BaseModel):
    id: str
    name: str
    kind: ItsAssetKind
    manufacturer: str = ""
    model: str = ""
    notes: str = ""
    # Module
    pmp_w: Optional[float] = None
    voc_v: Optional[float] = None
    isc_a: Optional[float] = None
    vmp_v: Optional[float] = None
    imp_a: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    bifacial: Optional[bool] = None
    # String
    modules_in_series: Optional[int] = None
    polarity_notes: str = ""
    module_spec_id: Optional[str] = None
    # String box
    inputs: Optional[int] = None
    fuse_rating_a: Optional[float] = None
    outgoing_cable: str = ""
    max_current_a: Optional[float] = None
    max_voltage_v: Optional[float] = None
    # ITS
    inverter_count: Optional[int] = None
    inverter_rating_kw: Optional[float] = None
    transformer_mva: Optional[float] = None
    transformer_mv_kv: Optional[float] = None
    auxiliaries: str = ""
    # Tracker / table
    modules_per_tracker: Optional[int] = None
    strings_per_tracker: Optional[int] = None
    table_length_m: Optional[float] = None
    table_width_m: Optional[float] = None


class ItsPlacedItem(BaseModel):
    id: str
    name: str
    kind: ItsItemKind
    spec_id: Optional[str] = None
    x: float = 80
    y: float = 80
    rows: int = Field(ge=1, default=4)
    tables_per_row: int = Field(ge=1, default=8)


class ItsString(BaseModel):
    id: str
    name: str
    table_id: Optional[str] = None
    spec_id: Optional[str] = None


class ItsAssignments(BaseModel):
    string_to_box: dict[str, str] = Field(default_factory=dict)
    box_to_its: dict[str, str] = Field(default_factory=dict)


class ItsHierarchy(BaseModel):
    modules_per_string: int = Field(ge=1, default=28)
    strings_per_table: int = Field(ge=1, default=2)
    table_count: int = Field(ge=0, default=32)
    string_box_count: int = Field(ge=0, default=8)
    its_count: int = Field(ge=0, default=1)
    auto_assign: bool = True


class ItsPvBlock(BaseModel):
    id: str
    name: str
    notes: str = ""
    catalog: list[ItsAssetSpec] = Field(default_factory=list)
    items: list[ItsPlacedItem] = Field(default_factory=list)
    strings: list[ItsString] = Field(default_factory=list)
    assignments: ItsAssignments = Field(default_factory=ItsAssignments)
    hierarchy: ItsHierarchy = Field(default_factory=ItsHierarchy)
    view: LayoutView = Field(default_factory=LayoutView)


class ItsDesign(BaseModel):
    blocks: list[ItsPvBlock] = Field(default_factory=list)


class ItsBlockCreate(BaseModel):
    name: str = "PV block"
    notes: str = ""
    seed: bool = True


class ItsBlockPatch(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    catalog: Optional[list[ItsAssetSpec]] = None
    items: Optional[list[ItsPlacedItem]] = None
    strings: Optional[list[ItsString]] = None
    assignments: Optional[ItsAssignments] = None
    hierarchy: Optional[ItsHierarchy] = None
    view: Optional[LayoutView] = None


class ItsWarning(BaseModel):
    code: str
    level: Literal["info", "warn", "fail"] = "warn"
    message: str


class ItsValidation(BaseModel):
    block_id: str
    table_count: int = 0
    string_count: int = 0
    string_box_count: int = 0
    its_count: int = 0
    assigned_strings: int = 0
    orphan_strings: int = 0
    orphan_boxes: int = 0
    overloaded_boxes: int = 0
    warnings: list[ItsWarning] = Field(default_factory=list)


AppModule = Literal["layout_config", "its_design"]


class Project(BaseModel):
    id: str
    name: str
    site: str = ""
    notes: str = ""
    owner: str = ""
    user_id: str = ""
    module: AppModule = "layout_config"
    created_at: str
    updated_at: str
    catalog: list[AssetDefinition] = Field(default_factory=list)
    topology: List[TopologyNode] = Field(default_factory=list)
    layout: Layout = Field(default_factory=Layout)
    parameters: ProjectParameters = Field(default_factory=ProjectParameters)
    electrical_bt: Optional[ElectricalBtConfig] = None
    electrical_mv: Optional[ElectricalMvConfig] = None
    its_design: ItsDesign = Field(default_factory=ItsDesign)

    @field_validator("topology", mode="before")
    @classmethod
    def wrap_topology(cls, value: Any) -> Any:
        return _as_topology_list(value)


class ProjectSummary(BaseModel):
    id: str
    name: str
    site: str
    owner: str = ""
    user_id: str = ""
    module: AppModule = "layout_config"
    updated_at: str
    created_at: str


class ProjectCreate(BaseModel):
    name: str
    site: str = ""
    notes: str = ""
    owner: Optional[str] = None
    user_id: Optional[str] = None
    seed_catalog: bool = True
    module: AppModule = "layout_config"


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    site: Optional[str] = None
    notes: Optional[str] = None
    module: Optional[AppModule] = None
    catalog: Optional[List[AssetDefinition]] = None
    topology: Optional[List[TopologyNode]] = None
    layout: Optional[Layout] = None
    parameters: Optional[ProjectParameters] = None
    electrical_bt: Optional[ElectricalBtConfig] = None
    electrical_mv: Optional[ElectricalMvConfig] = None
    its_design: Optional[ItsDesign] = None

    @field_validator("topology", mode="before")
    @classmethod
    def wrap_topology(cls, value: Any) -> Any:
        if value is None:
            return None
        return _as_topology_list(value)


class CatalogPayload(BaseModel):
    catalog: list[AssetDefinition]
