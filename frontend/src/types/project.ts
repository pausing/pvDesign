export type AssetKind =
  | "module"
  | "tracker"
  | "string_box"
  | "switching_box"
  | "inverter"
  | "dc_cable_l0"
  | "dc_cable_l1"
  | "mv_cable";

export type CableKind = "dc_l0" | "dc_l1" | "mv";
export type LayoutNodeType = "block" | "station" | "mv";
export type Orientation = "NS" | "EW";

export interface AssetDefinition {
  id: string;
  name: string;
  kind: AssetKind;
  manufacturer: string;
  model: string;
  notes: string;
  pmp_w: number | null;
  voc_v: number | null;
  isc_a: number | null;
  vmp_v: number | null;
  imp_a: number | null;
  length_mm: number | null;
  width_mm: number | null;
  bifacial: boolean | null;
  modules_per_tracker: number | null;
  strings_per_tracker: number | null;
  table_length_m: number | null;
  table_width_m: number | null;
  inputs: number | null;
  outputs: number | null;
  max_current_a: number | null;
  max_voltage_v: number | null;
  pac_kw: number | null;
  pdc_kw: number | null;
  max_dc_voltage_v: number | null;
  mppt_min_v: number | null;
  mppt_max_v: number | null;
  mppt_count: number | null;
  section_mm2: number | null;
  voltage_kv: number | null;
  ampacity_a: number | null;
  conductor: string | null;
}

export interface TopologyNode {
  id: string;
  asset_id: string;
  quantity_per_parent: number;
  cable_asset_id: string | null;
  cable_quantity: number | null;
  children: TopologyNode[];
}

export interface TrackerBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  rows: number;
  trackers_per_row: number;
  pitch_m: number;
  orientation: Orientation;
  rotation_deg: number;
  source_id?: string;
  subblock_poses?: SubBlockPose[];
  subblock_inner?: SubBlockInnerLayout[];
  subblock_type_inner?: SubBlockTypeInnerLayout[];
}

export interface SubBlockPose {
  id: string;
  x: number;
  y: number;
}

export interface InnerAssetPose {
  key: string;
  x: number;
  y: number;
}

export interface SubBlockInnerLayout {
  sub_id: string;
  poses: InnerAssetPose[];
}

export interface SubBlockTypeInnerLayout {
  type_id: string;
  poses: InnerAssetPose[];
}

export interface InverterStation {
  id: string;
  name: string;
  x: number;
  y: number;
  inverter_count: number;
  role?: "pcs" | "mv";
  source_id?: string;
}

export interface CableRun {
  id: string;
  kind: CableKind;
  from_id: string;
  to_id: string;
  from_type: LayoutNodeType;
  to_type: LayoutNodeType;
}

export interface LayoutView {
  x: number;
  y: number;
  zoom: number;
}

export interface Layout {
  blocks: TrackerBlock[];
  stations: InverterStation[];
  cable_runs: CableRun[];
  view: LayoutView;
}

export interface ProjectParameters {
  tracker_pitch_m: number;
  tracker_ns_gap_m: number;
}

export interface Project {
  id: string;
  name: string;
  site: string;
  notes: string;
  owner: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  catalog: AssetDefinition[];
  topology: TopologyNode[];
  layout: Layout;
  parameters?: ProjectParameters;
}

export interface ProjectSummary {
  id: string;
  name: string;
  site: string;
  owner?: string;
  user_id?: string;
  updated_at: string;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  site?: string;
  notes?: string;
  owner?: string;
  user_id?: string;
  seed_catalog?: boolean;
}

export const EMPTY_ASSET_FIELDS = {
  manufacturer: "",
  model: "",
  notes: "",
  pmp_w: null,
  voc_v: null,
  isc_a: null,
  vmp_v: null,
  imp_a: null,
  length_mm: null,
  width_mm: null,
  bifacial: null,
  modules_per_tracker: null,
  strings_per_tracker: null,
  table_length_m: null,
  table_width_m: null,
  inputs: null,
  outputs: null,
  max_current_a: null,
  max_voltage_v: null,
  pac_kw: null,
  pdc_kw: null,
  max_dc_voltage_v: null,
  mppt_min_v: null,
  mppt_max_v: null,
  mppt_count: null,
  section_mm2: null,
  voltage_kv: null,
  ampacity_a: null,
  conductor: null,
} satisfies Omit<AssetDefinition, "id" | "name" | "kind">;
