from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.its_design import default_its_design
from app.models import (
    AssetDefinition,
    CableRun,
    InverterStation,
    ItsDesign,
    Layout,
    Project,
    TopologyNode,
    TrackerBlock,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_catalog() -> list[AssetDefinition]:
    return [
        AssetDefinition(
            id="mod-580",
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
        AssetDefinition(
            id="trk-1p-56",
            name="1P tracker · 56 modules",
            kind="tracker",
            manufacturer="Generic",
            model="T-1P-56",
            modules_per_tracker=56,
            strings_per_tracker=2,
            table_length_m=64,
            table_width_m=2.4,
        ),
        AssetDefinition(
            id="sb-16",
            name="String box 16-in 1-out",
            kind="string_box",
            manufacturer="Generic",
            model="SB-16",
            inputs=16,
            outputs=1,
            max_current_a=400,
            max_voltage_v=1500,
        ),
        AssetDefinition(
            id="sw-8",
            name="Switching box 8-in 1-out",
            kind="switching_box",
            manufacturer="Generic",
            model="SW-8",
            inputs=8,
            outputs=1,
            max_current_a=2500,
            max_voltage_v=1500,
        ),
        AssetDefinition(
            id="inv-3125",
            name="3.125 MW central inverter",
            kind="inverter",
            manufacturer="Generic",
            model="INV-3125",
            pac_kw=3125,
            pdc_kw=3600,
            max_dc_voltage_v=1500,
            mppt_min_v=875,
            mppt_max_v=1300,
            mppt_count=1,
        ),
        AssetDefinition(
            id="cbl-l0-6",
            name="DC L0 6 mm² Cu",
            kind="dc_cable_l0",
            manufacturer="Generic",
            model="PV-6-CU",
            section_mm2=6,
            voltage_kv=1.8,
            ampacity_a=55,
            conductor="Cu",
        ),
        AssetDefinition(
            id="cbl-l1-240",
            name="DC L1 240 mm² Al",
            kind="dc_cable_l1",
            manufacturer="Generic",
            model="DC-240-AL",
            section_mm2=240,
            voltage_kv=1.8,
            ampacity_a=420,
            conductor="Al",
        ),
        AssetDefinition(
            id="cbl-mv-240",
            name="MV 35 kV 240 mm² Al",
            kind="mv_cable",
            manufacturer="Generic",
            model="MV-35-240",
            section_mm2=240,
            voltage_kv=35,
            ampacity_a=380,
            conductor="Al",
        ),
    ]


def default_topology() -> TopologyNode:
    """32 × 3.125 MW inverters ≈ 100 MWac, DC/AC ≈ 1.33."""
    return TopologyNode(
        id="node-inv",
        asset_id="inv-3125",
        quantity_per_parent=32,
        cable_asset_id="cbl-mv-240",
        cable_quantity=1,
        children=[
            TopologyNode(
                id="node-sw",
                asset_id="sw-8",
                quantity_per_parent=2,
                children=[
                    TopologyNode(
                        id="node-sb",
                        asset_id="sb-16",
                        quantity_per_parent=8,
                        cable_asset_id="cbl-l1-240",
                        cable_quantity=1,
                        children=[
                            TopologyNode(
                                id="node-trk",
                                asset_id="trk-1p-56",
                                quantity_per_parent=8,
                                cable_asset_id="cbl-l0-6",
                                cable_quantity=2,
                                children=[
                                    TopologyNode(
                                        id="node-mod",
                                        asset_id="mod-580",
                                        quantity_per_parent=56,
                                    )
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )


def default_layout() -> Layout:
    blocks = [
        TrackerBlock(id="blk-a", name="Block A", x=40, y=40, rows=8, trackers_per_row=16, pitch_m=12),
        TrackerBlock(id="blk-b", name="Block B", x=40, y=280, rows=8, trackers_per_row=16, pitch_m=12),
        TrackerBlock(id="blk-c", name="Block C", x=420, y=40, rows=8, trackers_per_row=16, pitch_m=12),
        TrackerBlock(id="blk-d", name="Block D", x=420, y=280, rows=8, trackers_per_row=16, pitch_m=12),
    ]
    stations = [
        InverterStation(id="st-1", name="PCS-01", x=250, y=150, inverter_count=1, role="pcs"),
        InverterStation(id="st-2", name="PCS-02", x=630, y=150, inverter_count=1, role="pcs"),
        InverterStation(id="st-3", name="PCS-03", x=250, y=390, inverter_count=1, role="pcs"),
        InverterStation(id="st-4", name="PCS-04", x=630, y=390, inverter_count=1, role="pcs"),
        InverterStation(id="st-mv", name="MV bus", x=440, y=520, inverter_count=0, role="mv"),
    ]
    runs = [
        CableRun(id="run-1", kind="dc_l1", from_id="blk-a", to_id="st-1", from_type="block", to_type="station"),
        CableRun(id="run-2", kind="dc_l1", from_id="blk-b", to_id="st-3", from_type="block", to_type="station"),
        CableRun(id="run-3", kind="dc_l1", from_id="blk-c", to_id="st-2", from_type="block", to_type="station"),
        CableRun(id="run-4", kind="dc_l1", from_id="blk-d", to_id="st-4", from_type="block", to_type="station"),
        CableRun(id="run-5", kind="mv", from_id="st-1", to_id="st-mv", from_type="station", to_type="station"),
        CableRun(id="run-6", kind="mv", from_id="st-2", to_id="st-mv", from_type="station", to_type="station"),
        CableRun(id="run-7", kind="mv", from_id="st-3", to_id="st-mv", from_type="station", to_type="station"),
        CableRun(id="run-8", kind="mv", from_id="st-4", to_id="st-mv", from_type="station", to_type="station"),
    ]
    return Layout(blocks=blocks, stations=stations, cable_runs=runs)


def empty_project(
    name: str,
    site: str = "",
    notes: str = "",
    seed_catalog: bool = True,
    owner: str = "",
    user_id: str = "",
    module: str = "layout_config",
) -> Project:
    now = utc_now()
    if module == "its_design":
        return Project(
            id=str(uuid4()),
            name=name,
            site=site,
            notes=notes,
            owner=owner,
            user_id=user_id,
            module="its_design",
            created_at=now,
            updated_at=now,
            catalog=[],
            topology=[],
            layout=Layout(),
            its_design=default_its_design() if seed_catalog else ItsDesign(),
        )
    catalog = default_catalog() if seed_catalog else []
    topology = default_topology() if seed_catalog else None
    layout = default_layout() if seed_catalog else Layout()
    if not seed_catalog:
        topology = None
    return Project(
        id=str(uuid4()),
        name=name,
        site=site,
        notes=notes,
        owner=owner,
        user_id=user_id,
        module="layout_config",
        created_at=now,
        updated_at=now,
        catalog=catalog,
        topology=topology,
        layout=layout,
        its_design=default_its_design() if seed_catalog else ItsDesign(),
    )


def demo_project() -> Project:
    now = utc_now()
    return Project(
        id="demo-100mw",
        name="Demo 100 MW",
        site="Atacama, Chile",
        notes="Layout configuration plant: 32 × 3.125 MW inverters, 1P trackers, 1500 V DC.",
        module="layout_config",
        created_at=now,
        updated_at=now,
        catalog=default_catalog(),
        topology=default_topology(),
        layout=default_layout(),
        its_design=default_its_design(),
    )


def demo_its_project() -> Project:
    now = utc_now()
    return Project(
        id="demo-its-block",
        name="Demo ITS block",
        site="Atacama, Chile",
        notes="Independent ITS Design plant: specs and string → string box → ITS grouping.",
        module="its_design",
        created_at=now,
        updated_at=now,
        catalog=[],
        topology=[],
        layout=Layout(),
        its_design=default_its_design(),
    )
