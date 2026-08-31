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


def _as_topology_list(value: Any) -> Any:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


class Project(BaseModel):
    id: str
    name: str
    site: str = ""
    notes: str = ""
    created_at: str
    updated_at: str
    catalog: list[AssetDefinition] = Field(default_factory=list)
    topology: List[TopologyNode] = Field(default_factory=list)
    layout: Layout = Field(default_factory=Layout)
    parameters: ProjectParameters = Field(default_factory=ProjectParameters)

    @field_validator("topology", mode="before")
    @classmethod
    def wrap_topology(cls, value: Any) -> Any:
        return _as_topology_list(value)


class ProjectSummary(BaseModel):
    id: str
    name: str
    site: str
    updated_at: str
    created_at: str


class ProjectCreate(BaseModel):
    name: str
    site: str = ""
    notes: str = ""
    seed_catalog: bool = True


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    site: Optional[str] = None
    notes: Optional[str] = None
    catalog: Optional[List[AssetDefinition]] = None
    topology: Optional[List[TopologyNode]] = None
    layout: Optional[Layout] = None
    parameters: Optional[ProjectParameters] = None

    @field_validator("topology", mode="before")
    @classmethod
    def wrap_topology(cls, value: Any) -> Any:
        if value is None:
            return None
        return _as_topology_list(value)


class CatalogPayload(BaseModel):
    catalog: list[AssetDefinition]
