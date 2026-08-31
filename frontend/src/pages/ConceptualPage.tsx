import { useOutletContext } from "react-router-dom";
import { Card } from "../components/ui";
import { KIND_COLOR, KIND_LABEL } from "../lib/kinds";
import { analyzePlant, asForest, walkTopology } from "../lib/topology";
import type { ProjectContext } from "../lib/useProject";
import type { AssetDefinition, TopologyNode } from "../types/project";

type Ctx = ProjectContext;

export function ConceptualPage() {
  const { project } = useOutletContext<Ctx>();
  if (!project) return <div className="p-8 text-muted">Loading…</div>;

  const rollup = analyzePlant(project);
  const forest = asForest(project.topology);
  const { instances } = walkTopology(forest);
  const byId = new Map(project.catalog.map((a) => [a.id, a]));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="DC capacity" value={`${rollup.dcMwp.toFixed(2)} MWp`} />
        <Metric label="AC capacity" value={`${rollup.acMw.toFixed(2)} MW`} />
        <Metric
          label="DC/AC"
          value={rollup.dcAc === null ? "—" : rollup.dcAc.toFixed(2)}
        />
        <Metric label="Inverters" value={String(rollup.inverters)} />
        <Metric label="Switching boxes" value={String(rollup.switchingBoxes)} />
        <Metric label="String boxes" value={String(rollup.stringBoxes)} />
        <Metric label="Trackers" value={String(rollup.trackers)} />
        <Metric label="Modules" value={rollup.modules.toLocaleString()} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <h2 className="mb-3 text-[15px] font-medium">Electrical hierarchy</h2>
          {forest.length > 0 ? (
            <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
              {forest.map((root, index) => (
                <div key={root.id}>
                  <div className="mb-2 text-[12px] text-muted">
                    {forest.length > 1 ? `Inverter block ${index + 1}` : "Plant"}
                  </div>
                  <TreeNode
                    node={root}
                    byId={byId}
                    instances={instances}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-muted">
              Define a hierarchy on the Config page to see the conceptual plant.
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-[15px] font-medium">Checks</h2>
            <div className="space-y-2">
              {rollup.checks.map((c) => (
                <Card key={c.id} className="px-3 py-2">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        c.level === "ok"
                          ? "bg-accent"
                          : c.level === "warn"
                            ? "bg-warn"
                            : "bg-danger"
                      }`}
                    />
                    <span className="font-medium">{c.title}</span>
                  </div>
                  <p className="mt-1 pl-4 font-mono text-[11px] text-muted">{c.detail}</p>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-[15px] font-medium">Bill of materials</h2>
            <Card className="overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-raised text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kind</th>
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.bom.map((row) => (
                    <tr key={`${row.assetId}-${row.name}`} className="border-t border-line">
                      <td className="px-3 py-1.5 text-muted">{KIND_LABEL[row.kind]}</td>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {rollup.bom.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted">
                        Empty
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-medium tabular-nums">{value}</div>
    </Card>
  );
}

function TreeNode({
  node,
  byId,
  instances,
}: {
  node: TopologyNode;
  byId: Map<string, AssetDefinition>;
  instances: Map<string, number>;
}) {
  const asset = byId.get(node.asset_id);
  const cable = node.cable_asset_id ? byId.get(node.cable_asset_id) : null;
  const total = instances.get(node.id) ?? node.quantity_per_parent;
  const color = asset ? KIND_COLOR[asset.kind] : "#666";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-raised px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <div>
          <div className="text-[13px] font-medium">{asset?.name ?? "Unknown asset"}</div>
          <div className="text-[11px] text-muted">
            {asset ? KIND_LABEL[asset.kind] : "missing"} · {node.quantity_per_parent} per parent ·{" "}
            {total.toLocaleString()} total
          </div>
        </div>
        {cable ? (
          <div className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {cable.name} × {node.cable_quantity ?? 1}
          </div>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <div className="ml-4 border-l border-line pl-4 pt-2">
          {node.children.map((child) => (
            <div key={child.id} className="mb-2">
              <TreeNode node={child} byId={byId} instances={instances} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
