import { useOutletContext } from "react-router-dom";
import { api, downloadJson, pickJsonFile } from "../api/client";
import { Button, Card, Field, NumInput, TextInput } from "../components/ui";
import { uid } from "../lib/ids";
import { ASSET_KINDS, CABLE_KINDS, KIND_COLOR, KIND_FIELDS, KIND_LABEL } from "../lib/kinds";
import { asForest, cloneNode, mapTopology } from "../lib/topology";
import { projectParameters } from "../lib/parameters";
import type { ProjectContext } from "../lib/useProject";
import type { AssetDefinition, AssetKind, TopologyNode } from "../types/project";
import { EMPTY_ASSET_FIELDS } from "../types/project";
import { useMemo, useState } from "react";

type Ctx = ProjectContext;

function newAsset(kind: AssetKind): AssetDefinition {
  return {
    id: uid(kind.slice(0, 3)),
    name: `New ${KIND_LABEL[kind]}`,
    kind,
    ...EMPTY_ASSET_FIELDS,
  };
}

function newNode(assetId: string): TopologyNode {
  return {
    id: uid("node"),
    asset_id: assetId,
    quantity_per_parent: 1,
    cable_asset_id: null,
    cable_quantity: null,
    children: [],
  };
}

export function ConfigPage() {
  const { project, update } = useOutletContext<Ctx>();
  const [kindFilter, setKindFilter] = useState<AssetKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const catalog = project?.catalog ?? [];
  const filtered = useMemo(
    () =>
      catalog.filter((a) => (kindFilter === "all" ? true : a.kind === kindFilter)),
    [catalog, kindFilter],
  );
  const selected = catalog.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  if (!project) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  const patchAsset = (id: string, patch: Partial<AssetDefinition>) => {
    update((p) => ({
      ...p,
      catalog: p.catalog.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const addAsset = (kind: AssetKind) => {
    const asset = newAsset(kind);
    update((p) => ({ ...p, catalog: [...p.catalog, asset] }));
    setSelectedId(asset.id);
    setKindFilter("all");
  };

  const deleteAsset = (id: string) => {
    if (!window.confirm("Remove this asset from the catalog?")) return;
    update((p) => ({ ...p, catalog: p.catalog.filter((a) => a.id !== id) }));
    setSelectedId(null);
  };

  const exportCatalog = () => {
    downloadJson(`${project.name.replace(/\s+/g, "_")}.catalog.json`, {
      catalog: project.catalog,
    });
  };

  const importCatalog = async () => {
    try {
      const data = (await pickJsonFile()) as { catalog?: AssetDefinition[] } | AssetDefinition[];
      const list = Array.isArray(data) ? data : (data.catalog ?? []);
      const result = await api.importCatalog(project.id, list);
      update((p) => ({ ...p, catalog: result.catalog }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Catalog import failed");
    }
  };

  const setForest = (topology: TopologyNode[]) => {
    update((p) => ({ ...p, topology }));
  };

  const equipment = catalog.filter((a) => !CABLE_KINDS.includes(a.kind));
  const cables = catalog.filter((a) => CABLE_KINDS.includes(a.kind));
  const forest = asForest(project.topology);
  const inverters = catalog.filter((a) => a.kind === "inverter");
  const blockAssets = inverters.length > 0 ? inverters : equipment;
  const params = projectParameters(project);

  const patchParameters = (patch: Partial<typeof params>) => {
    update((p) => ({
      ...p,
      parameters: { ...projectParameters(p), ...patch },
    }));
  };

  const addInverterBlock = (assetId: string) => {
    setForest([...forest, newNode(assetId)]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium">Tracker geometry</h2>
            <p className="text-[12px] text-muted">
              Plant-wide spacing for detailed layout. Pitch is E–W center-to-center when tables
              run N–S. N–S distance is the gap between table ends. Custom inner positions stay
              until you reset them.
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:w-auto">
            <Field label="Pitch (m)">
              <NumInput
                value={params.tracker_pitch_m}
                step="0.1"
                min={0.1}
                onChange={(v) =>
                  patchParameters({
                    tracker_pitch_m: v != null && v > 0 ? v : params.tracker_pitch_m,
                  })
                }
              />
            </Field>
            <Field label="N–S distance between trackers (m)">
              <NumInput
                value={params.tracker_ns_gap_m}
                step="0.1"
                min={0}
                onChange={(v) =>
                  patchParameters({
                    tracker_ns_gap_m: v != null && v >= 0 ? v : params.tracker_ns_gap_m,
                  })
                }
              />
            </Field>
          </div>
        </div>
      </section>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-medium">Asset library</h2>
            <p className="text-[12px] text-muted">Modules, trackers, boxes, inverters, cables</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void importCatalog()}>
              Import
            </Button>
            <Button variant="ghost" onClick={exportCatalog}>
              Export
            </Button>
            <select
              className="text-[13px]"
              defaultValue=""
              onChange={(e) => {
                const kind = e.target.value as AssetKind;
                if (kind) addAsset(kind);
                e.target.value = "";
              }}
            >
              <option value="">Add asset…</option>
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            All
          </FilterChip>
          {ASSET_KINDS.map((k) => (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
              {KIND_LABEL[k]}
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
                    style={{ background: KIND_COLOR[asset.kind] }}
                  />
                  <span className="min-w-0 truncate">{asset.name}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-[12px] text-muted">No assets in this filter.</li>
            ) : null}
          </ul>
          <div className="overflow-auto p-4">
            {selected ? (
              <AssetForm
                asset={selected}
                onChange={(patch) => patchAsset(selected.id, patch)}
                onDelete={() => deleteAsset(selected.id)}
              />
            ) : (
              <p className="text-muted">Add an asset to get started.</p>
            )}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-medium">Hierarchy</h2>
            <p className="text-[12px] text-muted">
              One inverter block per electrical configuration. Each can use a different
              inverter and hang a different tree underneath.
            </p>
          </div>
          <select
            className="text-[13px]"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) addInverterBlock(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Add inverter block…</option>
            {blockAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {KIND_LABEL[a.kind]} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {forest.length > 0 ? (
            <div className="space-y-4">
              {forest.map((root, index) => {
                const asset = catalog.find((a) => a.id === root.asset_id);
                return (
                  <div key={root.id}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[12px] text-muted">
                        Inverter block {index + 1}
                        {asset ? ` · ${asset.name}` : ""}
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setForest([...forest, cloneNode(root)])}
                      >
                        Duplicate
                      </Button>
                    </div>
                    <NodeEditor
                      node={root}
                      catalog={catalog}
                      equipment={equipment}
                      cables={cables}
                      depth={0}
                      quantityLabel="per plant"
                      onChange={(next) => {
                        if (!next) {
                          setForest(forest.filter((r) => r.id !== root.id));
                          return;
                        }
                        setForest(forest.map((r) => (r.id === root.id ? next : r)));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="p-6">
              <p className="mb-3 text-muted">
                No inverter blocks yet. Add one to start the electrical hierarchy.
              </p>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addInverterBlock(e.target.value);
                }}
              >
                <option value="">Add inverter block…</option>
                {blockAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {KIND_LABEL[a.kind]} — {a.name}
                  </option>
                ))}
              </select>
            </Card>
          )}
        </div>
      </section>
      </div>
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

function AssetForm({
  asset,
  onChange,
  onDelete,
}: {
  asset: AssetDefinition;
  onChange: (patch: Partial<AssetDefinition>) => void;
  onDelete: () => void;
}) {
  const fields = KIND_FIELDS[asset.kind];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={{ background: `${KIND_COLOR[asset.kind]}22`, color: KIND_COLOR[asset.kind] }}
        >
          {KIND_LABEL[asset.kind]}
        </span>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <Field label="Name">
        <TextInput value={asset.name} onChange={(v) => onChange({ name: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturer">
          <TextInput value={asset.manufacturer} onChange={(v) => onChange({ manufacturer: v })} />
        </Field>
        <Field label="Model">
          <TextInput value={asset.model} onChange={(v) => onChange({ model: v })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => {
          if (field.type === "bool") {
            const value = asset[field.key as keyof AssetDefinition];
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
            const value = (asset[field.key as keyof AssetDefinition] as string | null) ?? "";
            return (
              <Field key={field.key} label={field.label}>
                <TextInput value={value} onChange={(v) => onChange({ [field.key]: v })} />
              </Field>
            );
          }
          const value = asset[field.key as keyof AssetDefinition] as number | null;
          return (
            <Field key={field.key} label={field.label}>
              <NumInput
                value={value}
                step={field.step}
                onChange={(v) => onChange({ [field.key]: v })}
              />
            </Field>
          );
        })}
      </div>
      <Field label="Notes">
        <textarea
          rows={3}
          value={asset.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="w-full"
        />
      </Field>
    </div>
  );
}

function NodeEditor({
  node,
  catalog,
  equipment,
  cables,
  depth,
  quantityLabel = "per parent",
  onChange,
}: {
  node: TopologyNode;
  catalog: AssetDefinition[];
  equipment: AssetDefinition[];
  cables: AssetDefinition[];
  depth: number;
  quantityLabel?: string;
  onChange: (node: TopologyNode | null) => void;
}) {
  const asset = catalog.find((a) => a.id === node.asset_id);
  const cable = node.cable_asset_id
    ? catalog.find((a) => a.id === node.cable_asset_id)
    : null;

  const patch = (partial: Partial<TopologyNode>) => onChange({ ...node, ...partial });

  return (
    <div className="rounded-lg border border-line bg-raised/40">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: asset ? KIND_COLOR[asset.kind] : "#666" }}
        />
        <select
          value={node.asset_id}
          onChange={(e) => patch({ asset_id: e.target.value })}
          className="min-w-[180px] text-[13px]"
        >
          {equipment.map((a) => (
            <option key={a.id} value={a.id}>
              {KIND_LABEL[a.kind]} — {a.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[12px] text-muted">
          ×
          <input
            type="number"
            min={1}
            className="w-16"
            value={node.quantity_per_parent}
            onChange={(e) =>
              patch({ quantity_per_parent: Math.max(1, Number(e.target.value) || 1) })
            }
          />
          per {quantityLabel === "per plant" && depth === 0 ? "plant" : "parent"}
        </label>
        <span className="text-[12px] text-muted">via</span>
        <select
          value={node.cable_asset_id ?? ""}
          onChange={(e) =>
            patch({
              cable_asset_id: e.target.value || null,
              cable_quantity: e.target.value ? (node.cable_quantity ?? 1) : null,
            })
          }
          className="min-w-[140px] text-[13px]"
        >
          <option value="">No cable</option>
          {cables.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {node.cable_asset_id ? (
          <label className="flex items-center gap-1 text-[12px] text-muted">
            ×
            <input
              type="number"
              min={1}
              className="w-14"
              value={node.cable_quantity ?? 1}
              onChange={(e) =>
                patch({ cable_quantity: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
        ) : null}
        <div className="ml-auto flex gap-1">
          <select
            defaultValue=""
            className="text-[12px]"
            onChange={(e) => {
              if (!e.target.value) return;
              patch({ children: [...node.children, newNode(e.target.value)] });
              e.target.value = "";
            }}
          >
            <option value="">Add child…</option>
            {equipment.map((a) => (
              <option key={a.id} value={a.id}>
                {KIND_LABEL[a.kind]} — {a.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      </div>
      {cable ? (
        <div className="border-t border-line px-3 py-1 text-[11px] text-muted">
          Interconnect: {cable.name}
          {node.cable_quantity ? ` × ${node.cable_quantity} per asset` : ""}
        </div>
      ) : null}
      {node.children.length > 0 ? (
        <div className="space-y-2 border-t border-line p-2 pl-4">
          {node.children.map((child) => (
            <NodeEditor
              key={child.id}
              node={child}
              catalog={catalog}
              equipment={equipment}
              cables={cables}
              depth={depth + 1}
              onChange={(next) => {
                if (!next) {
                  onChange({
                    ...node,
                    children: node.children.filter((c) => c.id !== child.id),
                  });
                  return;
                }
                onChange(mapTopology(node, child.id, () => next));
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
