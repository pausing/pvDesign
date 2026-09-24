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
  modules_per_tracker?: number | null;
  strings_per_tracker?: number | null;
}

export interface ElectricalBtRow {
  subpark: string;
  its: string;
  its_id: string;
  inv: string;
  inverter_id: string;
  module_manufacturer: string;
  module_power_w: number | null;
  trackers: number | null;
  strings_inv: number | null;
  strings_its: number | null;
  n_modules: number | null;
  pot_dc_kwp_inv: number | null;
  pot_dc_kwp_its: number | null;
  pot_ac_kva_inv: number | null;
  pot_ac_kva_its: number | null;
  ratio: number | null;
  scb: string | null;
}

export interface ElectricalBtItsSummary {
  subpark: string;
  its: string;
  its_id: string;
  inverter_count: number;
  trackers: number | null;
  strings: number | null;
  n_modules: number | null;
  pot_dc_kwp: number | null;
  pot_ac_kva: number | null;
  ratio: number | null;
}

export interface ElectricalBtTotals {
  its_count: number;
  inverter_count: number;
  trackers: number | null;
  n_modules: number | null;
  pot_dc_kwp: number | null;
  pot_ac_kva: number | null;
}

export interface ElectricalBtConfig {
  source_filename: string;
  imported_at: string;
  sheet_name: string;
  trackers_header: string;
  modules_per_tracker: number;
  strings_per_tracker: number;
  rows: ElectricalBtRow[];
  by_its: ElectricalBtItsSummary[];
  totals: ElectricalBtTotals;
  warnings: string[];
}

export interface ElectricalMvRow {
  subpark: string;
  its: string;
  its_id: string;
  feeder_id: string;
  destination: string;
  voltage_kv: number | null;
  transformer_kva: number | null;
  cable_section_mm2: number | null;
  conductor: string;
  length_m: number | null;
  topology: "radial" | "ring" | "open-ring" | null;
  load_kva: number | null;
  notes: string;
}

export interface ElectricalMvConfig {
  source_filename: string;
  imported_at: string;
  sheet_name: string;
  rows: ElectricalMvRow[];
  warnings: string[];
}

export interface ElectricalBtPreview {
  kind: "bt";
  its_count: number;
  inverter_count: number;
  trackers: number | null;
  n_modules: number | null;
  pot_dc_kwp: number | null;
  pot_ac_kva: number | null;
  modules_per_tracker: number;
  strings_per_tracker: number;
  warnings: string[];
}

export interface ElectricalMvPreview {
  kind: "mv";
  feeder_count: number;
  its_count: number;
  load_kva: number | null;
  length_m: number | null;
  warnings: string[];
}

export interface PortalUser {
  id: string | null;
  email: string | null;
  admin: boolean | null;
}

export type ItsAssetKind = "module" | "string" | "string_box" | "its" | "tracker";
export type ItsItemKind = "table" | "string_box" | "its";

export interface ItsAssetSpec {
  id: string;
  name: string;
  kind: ItsAssetKind;
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
  modules_in_series: number | null;
  polarity_notes: string;
  module_spec_id: string | null;
  inputs: number | null;
  fuse_rating_a: number | null;
  outgoing_cable: string;
  max_current_a: number | null;
  max_voltage_v: number | null;
  inverter_count: number | null;
  inverter_rating_kw: number | null;
  transformer_mva: number | null;
  transformer_mv_kv: number | null;
  auxiliaries: string;
  modules_per_tracker: number | null;
  strings_per_tracker: number | null;
  table_length_m: number | null;
  table_width_m: number | null;
}

export interface ItsPlacedItem {
  id: string;
  name: string;
  kind: ItsItemKind;
  spec_id: string | null;
  x: number;
  y: number;
  rows: number;
  tables_per_row: number;
}

export interface ItsString {
  id: string;
  name: string;
  table_id: string | null;
  spec_id: string | null;
}

export interface ItsAssignments {
  string_to_box: Record<string, string>;
  box_to_its: Record<string, string>;
}

export interface ItsHierarchy {
  modules_per_string: number;
  strings_per_table: number;
  table_count: number;
  string_box_count: number;
  its_count: number;
  auto_assign: boolean;
}

export interface ItsPvBlock {
  id: string;
  name: string;
  notes: string;
  catalog: ItsAssetSpec[];
  items: ItsPlacedItem[];
  strings: ItsString[];
  assignments: ItsAssignments;
  hierarchy?: ItsHierarchy;
  view: LayoutView;
}

export interface ItsDesign {
  blocks: ItsPvBlock[];
}

export interface ItsWarning {
  code: string;
  level: "info" | "warn" | "fail";
  message: string;
}

export interface ItsValidation {
  block_id: string;
  table_count: number;
  string_count: number;
  string_box_count: number;
  its_count: number;
  assigned_strings: number;
  orphan_strings: number;
  orphan_boxes: number;
  overloaded_boxes: number;
  warnings: ItsWarning[];
}

export type AppModule = "layout_config" | "its_design";

export interface Project {
  id: string;
  name: string;
  site: string;
  notes: string;
  owner: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  module?: AppModule;
  catalog: AssetDefinition[];
  topology: TopologyNode[];
  layout: Layout;
  parameters?: ProjectParameters;
  electrical_bt?: ElectricalBtConfig | null;
  electrical_mv?: ElectricalMvConfig | null;
  its_design?: ItsDesign;
}

export interface ProjectSummary {
  id: string;
  name: string;
  site: string;
  owner?: string;
  user_id?: string;
  module?: AppModule;
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
  module?: AppModule;
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

export const EMPTY_ITS_SPEC_FIELDS = {
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
  modules_in_series: null,
  polarity_notes: "",
  module_spec_id: null,
  inputs: null,
  fuse_rating_a: null,
  outgoing_cable: "",
  max_current_a: null,
  max_voltage_v: null,
  inverter_count: null,
  inverter_rating_kw: null,
  transformer_mva: null,
  transformer_mv_kv: null,
  auxiliaries: "",
  modules_per_tracker: null,
  strings_per_tracker: null,
  table_length_m: null,
  table_width_m: null,
} satisfies Omit<ItsAssetSpec, "id" | "name" | "kind">;
