import type { AssetKind } from "../types/project";

export const ASSET_KINDS: AssetKind[] = [
  "module",
  "tracker",
  "string_box",
  "switching_box",
  "inverter",
  "dc_cable_l0",
  "dc_cable_l1",
  "mv_cable",
];

export const KIND_LABEL: Record<AssetKind, string> = {
  module: "Module",
  tracker: "Tracker",
  string_box: "String box",
  switching_box: "Switching box",
  inverter: "Inverter",
  dc_cable_l0: "DC cable L0",
  dc_cable_l1: "DC cable L1",
  mv_cable: "MV cable",
};

export const KIND_COLOR: Record<AssetKind, string> = {
  module: "#6ee7b7",
  tracker: "#34d399",
  string_box: "#60a5fa",
  switching_box: "#818cf8",
  inverter: "#fbbf24",
  dc_cable_l0: "#f472b6",
  dc_cable_l1: "#fb7185",
  mv_cable: "#fb923c",
};

export const CABLE_KINDS: AssetKind[] = ["dc_cable_l0", "dc_cable_l1", "mv_cable"];

export type FieldType = "number" | "text" | "bool";

export interface KindField {
  key: string;
  label: string;
  type: FieldType;
  step?: string;
}

export const KIND_FIELDS: Record<AssetKind, KindField[]> = {
  module: [
    { key: "pmp_w", label: "Pmp (W)", type: "number" },
    { key: "voc_v", label: "Voc (V)", type: "number", step: "0.1" },
    { key: "isc_a", label: "Isc (A)", type: "number", step: "0.01" },
    { key: "vmp_v", label: "Vmp (V)", type: "number", step: "0.1" },
    { key: "imp_a", label: "Imp (A)", type: "number", step: "0.01" },
    { key: "length_mm", label: "Length (mm)", type: "number" },
    { key: "width_mm", label: "Width (mm)", type: "number" },
    { key: "bifacial", label: "Bifacial", type: "bool" },
  ],
  tracker: [
    { key: "modules_per_tracker", label: "Modules / tracker", type: "number" },
    { key: "strings_per_tracker", label: "Strings / tracker", type: "number" },
    { key: "table_length_m", label: "Table length (m)", type: "number", step: "0.1" },
    { key: "table_width_m", label: "Table width (m)", type: "number", step: "0.1" },
  ],
  string_box: [
    { key: "inputs", label: "Inputs", type: "number" },
    { key: "outputs", label: "Outputs", type: "number" },
    { key: "max_current_a", label: "Max current (A)", type: "number" },
    { key: "max_voltage_v", label: "Max voltage (V)", type: "number" },
  ],
  switching_box: [
    { key: "inputs", label: "Inputs", type: "number" },
    { key: "outputs", label: "Outputs", type: "number" },
    { key: "max_current_a", label: "Max current (A)", type: "number" },
    { key: "max_voltage_v", label: "Max voltage (V)", type: "number" },
  ],
  inverter: [
    { key: "pac_kw", label: "Pac (kW)", type: "number" },
    { key: "pdc_kw", label: "Pdc max (kW)", type: "number" },
    { key: "max_dc_voltage_v", label: "Max DC voltage (V)", type: "number" },
    { key: "mppt_min_v", label: "MPPT min (V)", type: "number" },
    { key: "mppt_max_v", label: "MPPT max (V)", type: "number" },
    { key: "mppt_count", label: "MPPT count", type: "number" },
  ],
  dc_cable_l0: [
    { key: "section_mm2", label: "Section (mm²)", type: "number" },
    { key: "voltage_kv", label: "Voltage (kV)", type: "number", step: "0.1" },
    { key: "ampacity_a", label: "Ampacity (A)", type: "number" },
    { key: "conductor", label: "Conductor", type: "text" },
  ],
  dc_cable_l1: [
    { key: "section_mm2", label: "Section (mm²)", type: "number" },
    { key: "voltage_kv", label: "Voltage (kV)", type: "number", step: "0.1" },
    { key: "ampacity_a", label: "Ampacity (A)", type: "number" },
    { key: "conductor", label: "Conductor", type: "text" },
  ],
  mv_cable: [
    { key: "section_mm2", label: "Section (mm²)", type: "number" },
    { key: "voltage_kv", label: "Voltage (kV)", type: "number", step: "0.1" },
    { key: "ampacity_a", label: "Ampacity (A)", type: "number" },
    { key: "conductor", label: "Conductor", type: "text" },
  ],
};
