import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button, Card, Field, NumInput, TextInput } from "../components/ui";
import { firstSpec, newItsSpec } from "../lib/itsDesign";
import { ITS_ASSET_KINDS, ITS_KIND_COLOR, ITS_KIND_FIELDS, ITS_KIND_LABEL } from "../lib/itsKinds";
import type { ItsOutletContext } from "./ItsWorkspace";
import type { ItsAssetKind, ItsAssetSpec } from "../types/project";

export function ItsAssetsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { block, updateBlock } = useOutletContext<ItsOutletContext>();
  const [kindFilter, setKindFilter] = useState<ItsAssetKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => block.catalog.filter((a) => (kindFilter === "all" ? true : a.kind === kindFilter)),
    [block.catalog, kindFilter],
  );
  const selected = block.catalog.find((a) => a.id === selectedId) ?? filtered[0] ?? null;
  const moduleSpecs = block.catalog.filter((a) => a.kind === "module");

  const patchSpec = (id: string, patch: Partial<ItsAssetSpec>) => {
    updateBlock((current) => ({
      ...current,
      catalog: current.catalog.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const addSpec = (kind: ItsAssetKind) => {
    const spec = newItsSpec(kind);
    if (kind === "string") {
      const module = firstSpec(block, "module");
      spec.module_spec_id = module?.id ?? null;
      spec.modules_in_series = 28;
    }
    updateBlock((current) => ({ ...current, catalog: [...current.catalog, spec] }));
    setSelectedId(spec.id);
    setKindFilter("all");
  };

  const deleteSpec = (id: string) => {
    if (!window.confirm("Remove this spec from the PV block?")) return;
    updateBlock((current) => ({
      ...current,
      catalog: current.catalog.filter((a) => a.id !== id),
    }));
    setSelectedId(null);
  };

  const renameBlock = (name: string) => updateBlock((current) => ({ ...current, name }));

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_280px]">
      <section className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-medium">Asset specs</h2>
            <p className="text-[12px] text-muted">
              Define module, string, tracker, string box, and ITS ratings. Then set quantities on
              Hierarchy.
            </p>
          </div>
          <div className="flex items-center gap-2">
          <Button onClick={() => id && navigate(`/its/${id}/hierarchy`)}>Set hierarchy</Button>
          <select
            className="text-[13px]"
            defaultValue=""
            onChange={(e) => {
              const kind = e.target.value as ItsAssetKind;
              if (kind) addSpec(kind);
              e.target.value = "";
            }}
          >
            <option value="">Add spec…</option>
            {ITS_ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {ITS_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          </div>
        </div>
        <div className="flex items-end gap-3 border-b border-line px-4 py-3">
          <Field label="PV block name" className="max-w-sm flex-1">
            <TextInput value={block.name} onChange={renameBlock} />
          </Field>
          <Field label="Notes" className="flex-1">
            <TextInput
              value={block.notes}
              onChange={(notes) => updateBlock((current) => ({ ...current, notes }))}
            />
          </Field>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            All
          </FilterChip>
          {ITS_ASSET_KINDS.map((k) => (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
              {ITS_KIND_LABEL[k]}
            </FilterChip>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
          <ul className="overflow-auto border-r border-line">
            {filtered.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(asset.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] ${
                    selected?.id === asset.id ? "bg-raised" : "hover:bg-raised/60"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: ITS_KIND_COLOR[asset.kind] }}
                  />
                  <span className="min-w-0 truncate">{asset.name}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-[12px] text-muted">No specs in this filter.</li>
            ) : null}
          </ul>
          <div className="overflow-auto p-4">
            {selected ? (
              <SpecForm
                spec={selected}
                moduleSpecs={moduleSpecs}
                onChange={(patch) => patchSpec(selected.id, patch)}
                onDelete={() => deleteSpec(selected.id)}
              />
            ) : (
              <p className="text-muted">Add a spec to get started.</p>
            )}
          </div>
        </div>
      </section>
      <aside className="overflow-auto p-4">
        <h3 className="text-[13px] font-medium">Hierarchy</h3>
        <p className="mb-3 text-[12px] text-muted">Typical feed for this block.</p>
        <HierarchyTree blockName={block.name} catalog={block.catalog} />
      </aside>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
        active ? "bg-accent-dim text-accent" : "text-muted hover:bg-raised"
      }`}
    >
      {children}
    </button>
  );
}

function SpecForm({
  spec,
  moduleSpecs,
  onChange,
  onDelete,
}: {
  spec: ItsAssetSpec;
  moduleSpecs: ItsAssetSpec[];
  onChange: (patch: Partial<ItsAssetSpec>) => void;
  onDelete: () => void;
}) {
  const fields = ITS_KIND_FIELDS[spec.kind];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={{ background: `${ITS_KIND_COLOR[spec.kind]}22`, color: ITS_KIND_COLOR[spec.kind] }}
        >
          {ITS_KIND_LABEL[spec.kind]}
        </span>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <Field label="Name">
        <TextInput value={spec.name} onChange={(v) => onChange({ name: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturer">
          <TextInput value={spec.manufacturer} onChange={(v) => onChange({ manufacturer: v })} />
        </Field>
        <Field label="Model">
          <TextInput value={spec.model} onChange={(v) => onChange({ model: v })} />
        </Field>
      </div>
      {spec.kind === "string" ? (
        <Field label="Module in this string">
          <select
            className="w-full text-[13px]"
            value={spec.module_spec_id ?? ""}
            onChange={(e) => onChange({ module_spec_id: e.target.value || null })}
          >
            <option value="">Select module…</option>
            {moduleSpecs.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => {
          if (field.type === "bool") {
            const value = spec[field.key as keyof ItsAssetSpec];
            return (
              <label key={field.key} className="flex items-center gap-2 text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChange({ [field.key]: e.target.checked })}
                />
                {field.label}
              </label>
            );
          }
          if (field.type === "text") {
            const value = (spec[field.key as keyof ItsAssetSpec] as string | null) ?? "";
            return (
              <Field key={field.key} label={field.label} className="col-span-2">
                <TextInput value={value} onChange={(v) => onChange({ [field.key]: v })} />
              </Field>
            );
          }
          const value = spec[field.key as keyof ItsAssetSpec] as number | null;
          return (
            <Field key={field.key} label={field.label}>
              <NumInput value={value} step={field.step} onChange={(v) => onChange({ [field.key]: v })} />
            </Field>
          );
        })}
      </div>
      <Field label="Notes">
        <textarea
          rows={3}
          value={spec.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="w-full"
        />
      </Field>
    </div>
  );
}

function HierarchyTree({
  blockName,
  catalog,
}: {
  blockName: string;
  catalog: ItsAssetSpec[];
}) {
  const its = catalog.find((a) => a.kind === "its");
  const box = catalog.find((a) => a.kind === "string_box");
  const string = catalog.find((a) => a.kind === "string");
  const tracker = catalog.find((a) => a.kind === "tracker");
  const module =
    catalog.find((a) => a.id === string?.module_spec_id) ?? catalog.find((a) => a.kind === "module");

  const rows: { label: string; detail: string; color: string }[] = [
    {
      label: blockName,
      detail: "PV block",
      color: "#3dcc8c",
    },
    {
      label: its?.name ?? "ITS (not defined)",
      detail: its
        ? `${its.inverter_count ?? "?"} × ${its.inverter_rating_kw ?? "?"} kW · ${its.transformer_mva ?? "?"} MVA @ ${its.transformer_mv_kv ?? "?"} kV`
        : "Add an ITS spec",
      color: ITS_KIND_COLOR.its,
    },
    {
      label: box?.name ?? "String box (not defined)",
      detail: box
        ? `${box.inputs ?? "?"} inputs · fuse ${box.fuse_rating_a ?? "?"} A · ${box.outgoing_cable || "no outgoing cable"}`
        : "Add a string box spec",
      color: ITS_KIND_COLOR.string_box,
    },
    {
      label: string?.name ?? "String (not defined)",
      detail: string
        ? `${string.modules_in_series ?? "?"} modules in series${string.polarity_notes ? ` · ${string.polarity_notes}` : ""}`
        : "Add a string spec",
      color: ITS_KIND_COLOR.string,
    },
    {
      label: tracker?.name ?? "Tracker (optional)",
      detail: tracker
        ? `${tracker.modules_per_tracker ?? "?"} modules · ${tracker.strings_per_tracker ?? "?"} strings / table`
        : "Optional table geometry",
      color: ITS_KIND_COLOR.tracker,
    },
    {
      label: module?.name ?? "Module (not defined)",
      detail: module ? `${module.pmp_w ?? "?"} Wp${module.bifacial ? " · bifacial" : ""}` : "Add a module spec",
      color: ITS_KIND_COLOR.module,
    },
  ];

  return (
    <Card className="divide-y divide-line">
      {rows.map((row, index) => (
        <div key={row.label} className="px-3 py-2" style={{ paddingLeft: 12 + index * 10 }}>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
            {row.label}
          </div>
          <div className="pl-4 text-[11px] text-muted">{row.detail}</div>
        </div>
      ))}
    </Card>
  );
}
