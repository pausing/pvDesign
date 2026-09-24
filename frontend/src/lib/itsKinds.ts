import type { FieldType, KindField } from "./kinds";
import type { ItsAssetKind, ItsItemKind } from "../types/project";

export const ITS_ASSET_KINDS: ItsAssetKind[] = ["module", "string", "tracker", "string_box", "its"];

export const ITS_KIND_LABEL: Record<ItsAssetKind, string> = {
  module: "PV module",
  string: "String",
  tracker: "Tracker / table",
  string_box: "String box",
  its: "ITS skid",
};

export const ITS_ITEM_LABEL: Record<ItsItemKind, string> = {
  table: "Table field",
  string_box: "String box",
  its: "ITS",
};

export const ITS_KIND_COLOR: Record<ItsAssetKind | ItsItemKind, string> = {
  module: "#6ee7b7",
  string: "#a3e635",
  tracker: "#34d399",
  table: "#34d399",
  string_box: "#60a5fa",
  its: "#fbbf24",
};

export const ITS_KIND_FIELDS: Record<ItsAssetKind, KindField[]> = {
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
  string: [
    { key: "modules_in_series", label: "Modules in series", type: "number" },
    { key: "polarity_notes", label: "Polarity notes", type: "text" },
  ],
  tracker: [
    { key: "modules_per_tracker", label: "Modules / tracker", type: "number" },
    { key: "strings_per_tracker", label: "Strings / tracker", type: "number" },
    { key: "table_length_m", label: "Table length (m)", type: "number", step: "0.1" },
    { key: "table_width_m", label: "Table width (m)", type: "number", step: "0.1" },
  ],
  string_box: [
    { key: "inputs", label: "Inputs", type: "number" },
    { key: "fuse_rating_a", label: "Fuse rating (A)", type: "number", step: "0.1" },
    { key: "outgoing_cable", label: "Outgoing cable", type: "text" },
    { key: "max_current_a", label: "Max current (A)", type: "number" },
    { key: "max_voltage_v", label: "Max voltage (V)", type: "number" },
  ],
  its: [
    { key: "inverter_count", label: "Inverter count", type: "number" },
    { key: "inverter_rating_kw", label: "Inverter rating (kW)", type: "number" },
    { key: "transformer_mva", label: "Transformer (MVA)", type: "number", step: "0.1" },
    { key: "transformer_mv_kv", label: "MV voltage (kV)", type: "number", step: "0.1" },
    { key: "auxiliaries", label: "Auxiliaries", type: "text" },
  ],
};

export type { FieldType, KindField };
